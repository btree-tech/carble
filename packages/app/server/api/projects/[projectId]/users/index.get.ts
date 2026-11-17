import { users, usersToProjects } from '@carble/db/schema'
import { and, asc, eq, isNull } from 'drizzle-orm'

defineRouteMeta({
  openAPI: {
    tags: ['members'],
    summary: 'メンバーの一覧',
    // 入力: [場所, 名前, 型, 必須, 内容]
    'x-input': [
      ['パス', 'projectId', '整数', '必須', 'プロジェクトの ID'],
    ],
    // 処理: [条件, 処理]
    'x-process': [
      ['（常に）', 'プロジェクトのメンバーを、プロジェクトに加わった順に取得する'],
      ['自分がオーナー', '招待中のユーザーも含める'],
    ],
    // 出力: [状態, 条件, 本文]
    'x-output': [
      ['200', '（常に）', 'メンバーの配列。各メンバーに、ユーザーの ID（id）・ユーザーID（username）・名前（name）・ロール（role）・招待の状態（status）を付ける'],
    ],
    // エラー: [状態, 条件]（ログイン・メンバー・ロールによるものは docs/product-spec/features/roles.md）
    'x-errors': [
      ['409', 'プロジェクトに取り込み待ち・取り込み中のインポートがある'],
    ],
  },
})

export default defineEventHandler(async () => {
  const project = await findProject()

  const sessionUser = await useSessionUser()

  const isOwner = await useDatabase().query.usersToProjects.findFirst({
    where: ({ userId, projectId, role }, { and, eq }) => and(
      eq(userId, sessionUser.id),
      eq(projectId, project.id),
      eq(role, 'owner'),
    ),
  })

  return await useDatabase()
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      role: usersToProjects.role,
      status: usersToProjects.status,
    })
    .from(usersToProjects)
    .innerJoin(
      users,
      and(
        eq(users.id, usersToProjects.userId),
        eq(usersToProjects.projectId, project.id),
        isOwner ? undefined : isNull(usersToProjects.status),
      )
    )
    .orderBy(asc(usersToProjects.createdAt))
})
