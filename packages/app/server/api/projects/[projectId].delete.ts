import { projects } from '@carble/db/schema'
import { eq } from 'drizzle-orm'

defineRouteMeta({
  openAPI: {
    tags: ['projects'],
    summary: 'プロジェクトの削除',
    // 入力: [場所, 名前, 型, 必須, 内容]
    'x-input': [
      ['パス', 'projectId', '整数', '必須', 'プロジェクトの ID'],
    ],
    // 処理: [条件, 処理]
    'x-process': [
      ['（常に）', 'プロジェクトを、カード・項目・値・画像とともに削除する'],
      ['（常に）', '画像のファイルと縮小した画像のファイルを消す'],
    ],
    // 出力: [状態, 条件, 本文]
    'x-output': [
      ['204', '（常に）', 'なし'],
    ],
    // エラー: [状態, 条件]（ログイン・メンバー・ロールによるものは docs/product-spec/features/roles.md）
    'x-errors': [
    ],
  },
})

export default defineEventHandler(async () => {
  const sessionUser = await useSessionUser()
  const project = await findProject({
    users: {
      where: ({ userId, role }, { and, eq }) => and(
        eq(userId, sessionUser.id),
        eq(role, 'owner'),
      ),
      limit: 1,
    },
  })
  if (!project.users.length) throw createError({ statusCode: 404 })

  return await useDatabase().transaction(async (tx) => {
    const images = await tx.query.images.findMany({
      columns: { filename: true },
      where: ({ projectId }, { eq }) => eq(projectId, project.id),
    })

    await tx.delete(projects)
      .where(eq(projects.id, project.id))

    await Promise.all(
      images.map(({ filename }) => [
        useStorage('uploads/public/images').removeItem(filename),
        useStorage('uploads/public/thumbs').removeItem(`${filename}.webp`),
      ])
      .flat()
    )
  })
})
