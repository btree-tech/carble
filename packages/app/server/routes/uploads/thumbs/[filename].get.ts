import { createReadStream, existsSync } from 'node:fs'
import { basename } from 'node:path'
import sharp from 'sharp'
import z from 'zod'

defineRouteMeta({
  openAPI: {
    tags: ['images'],
    summary: '縮小した画像のファイル',
    // 入力: [場所, 名前, 型, 必須, 内容]
    'x-input': [
      ['パス', 'filename', '文字列', '必須', '画像のファイル名に .webp を付けたもの'],
    ],
    // 処理: [条件, 処理]
    'x-process': [
      ['縮小した画像がまだ無い', '長辺 640px 以内に縮小した画像（WebP）を作る。元の画像より大きくはしない'],
      ['縮小した画像がある', '作った縮小した画像を使う'],
    ],
    // 出力: [状態, 条件, 本文]
    'x-output': [
      ['200', '（常に）', '縮小した画像のファイル（WebP）'],
    ],
    // エラー: [状態, 条件]（ログイン・メンバー・ロールによるものは docs/product-spec/features/roles.md）
    'x-errors': [
      ['404', '元の画像のファイルが無い'],
    ],
  },
})

export default defineEventHandler(async (event) => {
  const { filename } = await getValidatedRouterParams(
    event,
    z.object({
      filename: z.string(),
    }).parse,
  )
  const imagePath = resolveStoragePath('uploads', 'public/images', basename(filename, '.webp'))
  const thumbPath = resolveStoragePath('uploads', 'public/thumbs', filename)

  if (!existsSync(imagePath)) {
    await useStorage('uploads/public/images').removeItem(filename)
    throw createError({ statusCode: 404 })
  }

  const user = await useSessionUser()

  const image = await useDatabase().query.images.findFirst({
    where: (t, { eq }) => eq(t.filename, basename(filename, '.webp')),
    with: {
      project: {
        with: {
          users: {
            where: ({ userId }, { eq }) => eq(userId, user.id),
            limit: 1,
          },
        },
      },
    },
  })
  if (!image?.project.users.length) throw createError({ statusCode: 404 })

  if (!existsSync(thumbPath)) {
    await sharp(imagePath)
      .resize({
        width: 640,
        height: 640,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp()
      .toFile(thumbPath)
  }

  return sendStream(event, createReadStream(thumbPath))
})
