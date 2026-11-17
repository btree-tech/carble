import { cards, images } from '@carble/db/schema'
import { createId } from '@paralleldrive/cuid2'
import { eq, max, sql } from 'drizzle-orm'
import { z } from 'zod'

defineRouteMeta({
  openAPI: {
    tags: ['cards'],
    summary: 'カードの追加',
    // 入力: [場所, 名前, 型, 必須, 内容]
    'x-input': [
      ['パス', 'projectId', '整数', '必須', 'プロジェクトの ID'],
      ['本文（JSON）', 'nextToId', '整数', '任意', 'このカードのすぐ下に追加する'],
      ['本文（multipart）', 'image', '画像のファイル', '任意', '追加するカードに付ける画像'],
    ],
    // 処理: [条件, 処理]
    'x-process': [
      ['（常に）', 'カードの ID を、プロジェクトの中でいちばん大きい ID の次にする'],
      ['nextToId が無い', '並び順の末尾に追加する'],
      ['nextToId がある', 'そのカードのすぐ下に追加し、プロジェクトのカードの並び順を 1 から振り直す'],
      ['image がある', '画像を保存し、カードに付ける'],
      ['（常に）', 'プロジェクトの最終更新日時を更新する'],
    ],
    // 出力: [状態, 条件, 本文]
    'x-output': [
      ['200', 'nextToId が無い', '追加したカード。画像（images）を付ける'],
      ['204', 'nextToId がある', 'なし'],
    ],
    // エラー: [状態, 条件]（ログイン・メンバー・ロールによるものは docs/product-spec/features/roles.md）
    'x-errors': [
      ['400', '本文が入力の形に合わない'],
      ['400', 'nextToId のカードがプロジェクトに無い'],
      ['400', 'image が画像のファイルでない'],
      ['409', 'プロジェクトに取り込み待ち・取り込み中のインポートがある'],
    ],
    // 実装との乖離
    'x-implementation-gap': [
      ['画像を付けずに追加すると、プロジェクトの最終更新日時を更新しない（[ISSUES.md](../../ISSUES.md#カードを追加しても最終更新日時が変わらない)）'],
    ],
  },
})

export default defineEventHandler(async (event) => {
  const project = await findProject()
  const data = getRequestHeader(event, 'content-type')?.startsWith('multipart/form-data')
    ? await readValidatedFormData(
        event,
        z.object({
          image: imageFileSchema.optional(),
        }).parseAsync
      )
    : await readValidatedBody(
        event,
        z.object({
          nextToId: z.number().optional(),
        }).parseAsync
      )

  return await useDatabase().transaction(async (tx) => {
    const [{
      maxCardId,
      maxOrder,
    }] = await tx
      .select({
        maxCardId: max(cards.id),
        maxOrder: max(cards.order),
      })
      .from(cards)
      .where(eq(cards.projectId, project.id))

    if ('nextToId' in data && data.nextToId) {
      const nextTo = await tx.query.cards.findFirst({
        where: ({ projectId, id }, { and, eq }) => and(
          eq(projectId, project.id),
          eq(id, data.nextToId!),
        ),
      })
      if (!nextTo) throw createValidationError()

      await tx.insert(cards)
        .values({
          projectId: project.id,
          id: (maxCardId ?? 0) + 1,
          order: nextTo.order + 0.5,
        })
        .returning()

      const newOrders = tx.$with('newOrders').as(
        tx.select({
            id: cards.id,
            order: sql<number>`row_number() over (order by "order" asc, "id" asc)`.as('order'),
          })
          .from(cards)
          .where(eq(cards.projectId, project.id))
      )
      await tx.with(newOrders)
        .update(cards)
        .set({
          order: sql`(select ${newOrders.order} from ${newOrders} where ${cards.id} = ${newOrders.id})`,
        })
        .where(eq(cards.projectId, project.id))

      return
    }

    const [card] = await tx.insert(cards)
      .values({
        projectId: project.id,
        id: (maxCardId ?? 0) + 1,
        order: (maxOrder ?? 0) + 1,
      })
      .returning()

    const cardImages: typeof images.$inferSelect[] = []
    if (data?.image) {
      const filename = `${createId()}.${data.image.ext}`

      const [image] = await tx.insert(images)
        .values({
          projectId: project.id,
          cardId: card.id,
          filename,
        })
        .returning()
      cardImages.push(image)

      await useStorage('uploads/public/images').setItemRaw(filename, Buffer.from(await data.image.data.arrayBuffer()))

      await touchProjectUpdatedAt(tx)
    }

    return {
      ...card,
      images: cardImages,
    }
  })
})
