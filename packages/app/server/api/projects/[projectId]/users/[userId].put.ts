import { usersToProjects } from '@carble/db/schema'
import { and, eq } from 'drizzle-orm'
import z from 'zod'

defineRouteMeta({
  openAPI: {
    tags: ['members'],
    summary: '招待の承認',
    // 入力: [場所, 名前, 型, 必須, 内容]
    'x-input': [
      ['パス', 'projectId', '整数', '必須', 'プロジェクトの ID'],
      ['パス', 'userId', '文字列', '必須', '自分のユーザーの ID'],
      ['本文（JSON）', 'status', 'null', '必須', '招待を承認すること'],
    ],
    // 処理: [条件, 処理]
    'x-process': [
      ['（常に）', '招待を承認し、プロジェクトの編集者にする'],
    ],
    // 出力: [状態, 条件, 本文]
    'x-output': [
      ['204', '（常に）', 'なし'],
    ],
    // エラー: [状態, 条件]（ログイン・メンバー・ロールによるものは docs/product-spec/features/roles.md）
    'x-errors': [
      ['400', '本文が入力の形に合わない'],
      ['409', 'プロジェクトに取り込み待ち・取り込み中のインポートがある'],
    ],
  },
})

export default defineEventHandler(async (event) => {
  const sessionUser = await useSessionUser()
  if (sessionUser.id !== getRouterParam(event, 'userId')) throw createError({ statusCode: 404 })
  const project = await findProject({
    users: {
      where: ({ userId, status }, { and, eq }) => and(
        eq(userId, sessionUser.id),
        eq(status, 'invited'),
      ),
      limit: 1,
    },
  })
  if (!project.users.length) throw createError({ statusCode: 404 })

  const data = await readValidatedBody(
    event,
    z.object({
      status: z.null(),
    }).parse,
  )

  await useDatabase().update(usersToProjects)
    .set({
      userId: sessionUser.id,
      projectId: project.id,
      status: data.status,
    })
    .where(and(
      eq(usersToProjects.userId, sessionUser.id),
      eq(usersToProjects.projectId, project.id),
    ))
})
