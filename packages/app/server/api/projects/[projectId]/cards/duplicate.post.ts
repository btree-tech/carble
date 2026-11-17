import type { Transaction } from '@carble/db'
import { cards, contents, fields, images, projects } from '@carble/db/schema'
import { createId } from '@paralleldrive/cuid2'
import { eq, sql } from 'drizzle-orm'
import { createSelectSchema } from 'drizzle-zod'
import { copyFile } from 'node:fs/promises'
import { extname } from 'node:path'
import z from 'zod'

type FromProject  = typeof projects.$inferSelect & {
  fields: (typeof fields.$inferSelect)[]
  cards: (typeof cards.$inferSelect & {
    contents: (typeof contents.$inferSelect)[]
    images: (typeof images.$inferSelect)[]
  })[]
}

defineRouteMeta({
  openAPI: {
    tags: ['cards'],
    summary: 'カードの複製',
    // 入力: [場所, 名前, 型, 必須, 内容]
    'x-input': [
      ['パス', 'projectId', '整数', '必須', 'プロジェクトの ID'],
      ['本文（JSON）', 'cardId', '整数の配列', '必須', '複製するカードの ID（1 つ以上）'],
      ['本文（JSON）', 'toProjectId', '整数', '任意', '複製先のプロジェクトの ID'],
      ['本文（JSON）', 'nextToId', '整数', '任意', 'このカード（複製するカードのどれか）のすぐ下に複製する'],
    ],
    // 処理: [条件, 処理]
    'x-process': [
      ['（常に）', 'カードを、値・画像（ファイルも）とともに複製する'],
      ['（常に）', '複製したカードに、複製元のカードを覚えさせる'],
      ['（常に）', '複製先に無い名前の項目を、複製先の項目の末尾に作る'],
      ['toProjectId がある', 'そのプロジェクトの末尾に、元の並び順で複製する'],
      ['toProjectId が無い', '「無題のプロジェクト」を作り、そこに複製する'],
      ['nextToId がある', 'そのカードのすぐ下に複製し、複製先のカードの並び順を 1 から振り直す'],
      ['（常に）', '複製先のプロジェクトの最終更新日時を更新する'],
    ],
    // 出力: [状態, 条件, 本文]
    'x-output': [
      ['200', '（常に）', '複製したカードの配列'],
    ],
    // エラー: [状態, 条件]（ログイン・メンバー・ロールによるものは docs/product-spec/features/roles.md）
    'x-errors': [
      ['400', '本文が入力の形に合わない'],
      ['400', 'toProjectId のプロジェクトが無い'],
      ['409', 'プロジェクトに取り込み待ち・取り込み中のインポートがある'],
    ],
    // 実装との乖離
    'x-implementation-gap': [
      ['toProjectId を送らずに作ったプロジェクトには、オーナーを設定しない（[ISSUES.md](../../ISSUES.md#新しいプロジェクトに複製するとプロジェクトを開けない)）'],
    ],
  },
})

export default defineEventHandler(async (event) => {
  const data = await readValidatedBody(
    event,
    z.object({
      cardId: z.array(createSelectSchema(cards).shape.id).nonempty(),
      toProjectId: createSelectSchema(projects).shape.id.optional(),
      nextToId: createSelectSchema(cards).shape.id.optional(),
    }).parse,
  )

  const fromProject = await findProject({
    fields: true,
    cards: {
      where: ({ id }, { inArray }) => inArray(id, data.cardId),
      orderBy: ({ order, id }, { asc }) => [asc(order), asc(id)],
      with: {
        contents: true,
        images: true,
      },
    },
  }) as unknown as FromProject

  return await useDatabase().transaction(async (tx) => {
    const {
      project: toProject,
      maxFieldOrder,
      maxCardId,
      maxCardOrder,
    } = await findOrCreateProject(tx, data.toProjectId)

    const nextToOrder = 'nextToId' in data
      ? fromProject.cards.find(({ id }) => id === data.nextToId)?.order
      : undefined

    const insertFieldValues = fromProject.fields
      .filter(({ name }) => !(toProject.fields ?? []).find((f) => f.name === name))
      .map(({ name }, i) => ({
        projectId: toProject.id,
        order: maxFieldOrder + 1 + i,
        name,
      } satisfies typeof fields.$inferInsert))
    const newFields = insertFieldValues.length
      ? await tx.insert(fields)
          .values(insertFieldValues)
          .returning()
      : []
    const fieldsMap = new Map(
      [...toProject.fields, ...newFields].map(({ id, name }) => [name ?? '', id])
    )

    const insertCardValues = fromProject.cards.map(({ id }, i) => ({
      projectId: toProject.id,
      id: (maxCardId ?? 0) + 1 + i,
      order: nextToOrder ? nextToOrder + (1 + i) * 0.1 : (maxCardOrder ?? 0) + 1 + i,
      originalProjectId: fromProject.id,
      originalCardId: id,
    } satisfies typeof cards.$inferInsert))

    const newCards = await tx.insert(cards).values(insertCardValues).returning()

    if (nextToOrder) {
      const newOrders = tx.$with('newOrders').as(
        tx.select({
            id: cards.id,
            order: sql<number>`row_number() over (order by "order" asc, "id" asc)`.as('order'),
          })
          .from(cards)
          .where(eq(cards.projectId, toProject.id))
      )
      await tx.with(newOrders)
        .update(cards)
        .set({
          order: sql`(select ${newOrders.order} from ${newOrders} where ${cards.id} = ${newOrders.id})`,
        })
        .where(eq(cards.projectId, toProject.id))
    }

    const insertContentValues = fromProject.cards.flatMap(({ contents: fromContents }, i) => {
      return fromContents.map(({ fieldId, body }) => {
        const fieldName = fromProject.fields.find(({ id }) => fieldId === id)?.name ?? ''
        return {
          projectId: toProject.id,
          cardId: (maxCardId ?? 0) + 1 + i,
          fieldId: fieldsMap.get(fieldName)!,
          body,
        } satisfies typeof contents.$inferInsert
      })
    })

    if (insertContentValues.length) {
      await tx.insert(contents).values(insertContentValues)
    }

    const imagesMap = new Map(
      fromProject.cards.flatMap(({ images }) => {
        return images.map(({ filename }) => [
          filename,
          `${createId()}.${extname(filename)}`
        ])
      })
    )
    const insertImageValues = fromProject.cards.flatMap(({ images: fromImages }, i) => {
      return fromImages.map(({ filename }) => ({
        projectId: toProject.id,
        cardId: (maxCardId ?? 0) + 1 + i,
        filename: imagesMap.get(filename)!,
      } satisfies typeof images.$inferInsert))
    })

    if (insertImageValues.length) {
      await tx.insert(images).values(insertImageValues)

      await Promise.all(imagesMap.entries().map((([from, to]) => {
        return copyFile(
          resolveStoragePath('uploads', 'public/images', from),
          resolveStoragePath('uploads', 'public/images', to),
        )
      })))
    }

    await touchProjectUpdatedAt(tx, toProject.id)

    return newCards
  })
})

async function findOrCreateProject(tx: Transaction, projectId?: number) {
  if (projectId) {
    const project = await tx.query.projects.findFirst({
      where: ({ id }, { eq }) => eq(id, projectId),
      with: {
        fields: true,
        cards: {
          columns: {
            id: true,
            order: true,
          },
        },
      },
    })
    if (!project) throw createValidationError()
    return {
      project,
      maxFieldOrder: Math.max(0, ...project.fields.map(({ order }) => order)),
      maxCardId: Math.max(0, ...project.cards.map(({ id }) => id)),
      maxCardOrder: Math.max(0, ...project.cards.map(({ order }) => order)),
    }
  } else {
    const [project] = await tx.insert(projects).values({ name: '無題のプロジェクト' }).returning()
    return {
      project: {
        ...project,
        fields: [],
        cards: [],
      },
      maxFieldOrder: 0,
      maxCardId: 0,
      maxCardOrder: 0,
    }
  }
}
