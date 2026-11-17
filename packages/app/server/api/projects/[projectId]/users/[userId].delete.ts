import { usersToProjects } from '@carble/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import z from 'zod'

defineRouteMeta({
  openAPI: {
    tags: ['members'],
    summary: 'メンバーを外す・招待の取り消し・招待の拒否',
    // 入力: [場所, 名前, 型, 必須, 内容]
    'x-input': [
      ['パス', 'projectId', '整数', '必須', 'プロジェクトの ID'],
      ['パス', 'userId', '文字列', '必須', '外すユーザーの ID'],
    ],
    // 処理: [条件, 処理]
    'x-process': [
      ['自分がオーナーで、userId が編集者', 'そのユーザーをプロジェクトから外す'],
      ['自分がオーナーで、userId が招待中のユーザー', '招待を取り消す'],
      ['userId が自分で、自分が招待中', '招待を拒否する'],
    ],
    // 出力: [状態, 条件, 本文]
    'x-output': [
      ['204', '（常に）', 'なし'],
    ],
    // エラー: [状態, 条件]（ログイン・メンバー・ロールによるものは docs/product-spec/features/roles.md）
    'x-errors': [
      ['409', 'プロジェクトに取り込み待ち・取り込み中のインポートがある'],
    ],
  },
})

export default defineEventHandler(async (event) => {
  const data = await getValidatedRouterParams(
    event,
    z.object({
      userId: z.string(),
    }).parse,
  )
  const sessionUser = await useSessionUser()
  const targetIsSelf = data.userId === sessionUser.id
  const project = await findProject(targetIsSelf
    ? {
        users: {
          where: ({ userId, role, status }, { and, eq, isNull }) => and(
            eq(userId, data.userId),
            isNull(role),
            eq(status, 'invited'),
          ),
          limit: 1,
        },
      }
    : {
        users: {
          where: ({ userId, role }, { or, and, eq, isNull }) =>or(
            and(
              eq(userId, data.userId),
              isNull(role),
            ),
            and(
              eq(userId, sessionUser.id),
              eq(role, 'owner'),
            ),
          ),
          limit: 2,
        },
      }
  )
  if (project.users.length < 1 || (!targetIsSelf && project.users.length < 2)) throw createError({ statusCode: 404 })

  await useDatabase()
    .delete(usersToProjects)
    .where(and(
      eq(usersToProjects.projectId, project.id),
      eq(usersToProjects.userId, data.userId),
      isNull(usersToProjects.role),
    ))
})
