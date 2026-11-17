import { cards } from '@carble/db/schema'
import { and, eq } from 'drizzle-orm'

defineRouteMeta({
  openAPI: {
    tags: ['cards'],
    summary: 'カードの削除',
    // 入力: [場所, 名前, 型, 必須, 内容]
    'x-input': [
      ['パス', 'projectId', '整数', '必須', 'プロジェクトの ID'],
      ['パス', 'cardId', '整数', '必須', 'カードの ID'],
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
      ['404', 'cardId のカードがプロジェクトに無い'],
      ['409', 'プロジェクトに取り込み待ち・取り込み中のインポートがある'],
    ],
  },
})

export default defineEventHandler(async () => {
  const card = await findCard()
  return await useDatabase().transaction(async (tx) => {
    const images = await tx.query.images.findMany({
      columns: { filename: true },
      where: (t, { and, eq }) => and(
        eq(t.projectId, card.projectId),
        eq(t.cardId, card.id),
      ),
    })

    await tx.delete(cards)
      .where(and(
        eq(cards.projectId, card.projectId),
        eq(cards.id, card.id),
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
