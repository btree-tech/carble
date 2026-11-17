import { images } from '@carble/db/schema'
import { eq } from 'drizzle-orm'
import z from 'zod'

defineRouteMeta({
  openAPI: {
    tags: ['images'],
    summary: '画像の削除',
    // 入力: [場所, 名前, 型, 必須, 内容]
    'x-input': [
      ['パス', 'projectId', '整数', '必須', 'プロジェクトの ID'],
      ['パス', 'cardId', '整数', '必須', 'カードの ID'],
      ['パス', 'imageId', '整数', '必須', '画像の ID'],
    ],
    // 処理: [条件, 処理]
    'x-process': [
      ['（常に）', '画像を削除する'],
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
      ['404', 'imageId の画像が無い'],
      ['409', 'プロジェクトに取り込み待ち・取り込み中のインポートがある'],
    ],
  },
})

export default defineEventHandler(async (event) => {
  await findCard()

  const {
    imageId,
  } = await getValidatedRouterParams(
    event,
    z.object({
      imageId: z.coerce.number(),
    }).parse,
  )

  return await useDatabase().transaction(async (tx) => {
    const image = await tx.query.images.findFirst({
      where: ({ id }, { eq }) => eq(id, imageId)
    })
    if (!image) throw createError({ statusCode: 404 })

    await tx.delete(images)
      .where(eq(images.id, imageId))

    await touchProjectUpdatedAt(tx)

    await useStorage('uploads/public/images').removeItem(image.filename)
    await useStorage('uploads/public/thumbs').removeItem(`${image.filename}.webp`)
  })
})
