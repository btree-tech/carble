import { images } from '@carble/db/schema'
import { createId } from '@paralleldrive/cuid2'
import { z } from 'zod'

defineRouteMeta({
  openAPI: {
    tags: ['images'],
    summary: '画像の追加',
    // 入力: [場所, 名前, 型, 必須, 内容]
    'x-input': [
      ['パス', 'projectId', '整数', '必須', 'プロジェクトの ID'],
      ['パス', 'cardId', '整数', '必須', 'カードの ID'],
      ['本文（multipart）', 'image', '画像のファイル', '必須', '追加する画像'],
    ],
    // 処理: [条件, 処理]
    'x-process': [
      ['（常に）', '画像を保存し、カードに付ける'],
      ['（常に）', 'プロジェクトの最終更新日時を更新する'],
    ],
    // 出力: [状態, 条件, 本文]
    'x-output': [
      ['200', '（常に）', '追加した画像'],
    ],
    // エラー: [状態, 条件]（ログイン・メンバー・ロールによるものは docs/product-spec/features/roles.md）
    'x-errors': [
      ['400', 'image が無いか、画像のファイルでない'],
      ['404', 'cardId のカードがプロジェクトに無い'],
      ['409', 'プロジェクトに取り込み待ち・取り込み中のインポートがある'],
    ],
  },
})

export default defineEventHandler(async (event) => {
  const card = await findCard()
  const data = await readValidatedFormData(
    event,
    z.object({
      image: imageFileSchema,
    }).parseAsync
  )

  const filename = `${createId()}.${data.image.ext}`

  return await useDatabase().transaction(async (tx) => {
    const [image] = await tx.insert(images)
      .values({
        projectId: card.projectId,
        cardId: card.id,
        filename,
      })
      .returning()

    await touchProjectUpdatedAt(tx)

    await useStorage('uploads/public/images').setItemRaw(filename, Buffer.from(await data.image.data.arrayBuffer()))

    return image
  })
})
