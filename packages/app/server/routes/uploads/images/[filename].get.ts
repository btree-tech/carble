import { createReadStream, existsSync } from 'node:fs'
import z from 'zod'

defineRouteMeta({
  openAPI: {
    tags: ['images'],
    summary: '画像のファイル',
    // 入力: [場所, 名前, 型, 必須, 内容]
    'x-input': [
      ['パス', 'filename', '文字列', '必須', '画像のファイル名'],
    ],
    // 処理: [条件, 処理]
    'x-process': [
      ['（常に）', '画像のファイルを読む'],
    ],
    // 出力: [状態, 条件, 本文]
    'x-output': [
      ['200', '（常に）', '画像のファイル'],
    ],
    // エラー: [状態, 条件]（ログイン・メンバー・ロールによるものは docs/product-spec/features/roles.md）
    'x-errors': [
      ['404', 'filename のファイルが無い'],
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
  const path = resolveStoragePath('uploads', 'public/images', filename)

  if (!existsSync(path)) throw createError({ statusCode: 404 })

  const user = await useSessionUser()

  const image = await useDatabase().query.images.findFirst({
    where: (t, { eq }) => eq(t.filename, filename),
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

  return sendStream(event, createReadStream(path))
})
