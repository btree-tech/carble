import { cards } from '@carble/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { createSelectSchema } from 'drizzle-zod'
import z from 'zod'

defineRouteMeta({
  openAPI: {
    tags: ['cards'],
    summary: 'カードの一括削除',
    // 入力: [場所, 名前, 型, 必須, 内容]
    'x-input': [
      ['パス', 'projectId', '整数', '必須', 'プロジェクトの ID'],
      ['本文（JSON）', 'ids', '整数の配列', '必須', '削除するカードの ID'],
    ],
    // 処理: [条件, 処理]
    'x-process': [
      ['（常に）', 'カードを、値・画像とともに削除する'],
      ['（常に）', '画像のファイルと縮小した画像のファイルを消す'],
      ['（常に）', 'プロジェクトの最終更新日時を更新する'],
    ],
    // 出力: [状態, 条件, 本文]
    'x-output': [
      ['204', '（常に）', 'なし'],
    ],
    // エラー: [状態, 条件]（ログイン・メンバー・ロールによるものは docs/product-spec/features/roles.md）
    'x-errors': [
      ['400', '本文が入力の形に合わない'],
      ['400', 'ids にプロジェクトに無いカードの ID がある'],
      ['409', 'プロジェクトに取り込み待ち・取り込み中のインポートがある'],
    ],
  },
})

export default defineEventHandler(async (event) => {
  const project = await findProject({
    cards: {
      columns: {
        id: true,
      },
    },
  })
  const data = await readValidatedBody(
    event,
    z.object({
      ids: z.array(createSelectSchema(cards).shape.id).superRefine((value, context) => {
        const ids = project.cards.map(({ id }) => id)
        if (value.some((id) => !ids.includes(id))) {
          context.addIssue({
            code: 'invalid_value',
            values: value,
          })
        }
      })
    }).parse,
  )
  return await useDatabase().transaction(async (tx) => {
    const images = await tx.query.images.findMany({
      columns: { filename: true },
      where: (t, { and, eq, inArray }) => and(
        eq(t.projectId, project.id),
        inArray(t.cardId, data.ids),
      ),
    })

    await tx.delete(cards)
      .where(and(
        eq(cards.projectId, project.id),
        inArray(cards.id, data.ids),
      ))

    await touchProjectUpdatedAt(tx)

    await Promise.all(
      images.map(({ filename }) => [
        useStorage('uploads/public/images').removeItem(filename),
        useStorage('uploads/public/thumbs').removeItem(`${filename}.webp`),
      ])
      .flat()
    )
  })
})
