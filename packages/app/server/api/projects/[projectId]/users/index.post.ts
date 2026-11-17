import { usersToProjects } from '@carble/db/schema'
import z from 'zod'

defineRouteMeta({
  openAPI: {
    tags: ['members'],
    summary: 'ユーザーの招待',
    // 入力: [場所, 名前, 型, 必須, 内容]
    'x-input': [
      ['パス', 'projectId', '整数', '必須', 'プロジェクトの ID'],
      ['本文（JSON）', 'username', '文字列', '必須', '招待するユーザーのユーザーID'],
      ['本文（JSON）', 'status', 'invited', '必須', '招待すること'],
    ],
    // 処理: [条件, 処理]
    'x-process': [
      ['（常に）', 'username のユーザーを、プロジェクトに招待中のユーザーとして加える'],
    ],
    // 出力: [状態, 条件, 本文]
    'x-output': [
      ['204', '（常に）', 'なし'],
    ],
    // エラー: [状態, 条件]（ログイン・メンバー・ロールによるものは docs/product-spec/features/roles.md）
    'x-errors': [
      ['400', '本文が入力の形に合わない'],
      ['400', 'username のユーザーがいない'],
      ['409', 'プロジェクトに取り込み待ち・取り込み中のインポートがある'],
    ],
    // 実装との乖離
    'x-implementation-gap': [
      ['すでにメンバー・招待中のユーザーを招待すると、サーバーがエラー（500）を返す（[ISSUES.md](../../ISSUES.md#招待済みのユーザーを招待すると存在しないidですと表示する)）'],
    ],
  },
})

export default defineEventHandler(async (event) => {
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

  const data = await readValidatedBody(
    event,
    z.object({
      username: z.string(),
      status: z.literal('invited'),
    }).parse,
  )

  const user = await useDatabase().query.users.findFirst({
    where: ({ username }, { eq }) => eq(username, data.username),
  })
  if (!user) throw createValidationError()

  await useDatabase().insert(usersToProjects)
    .values({
      userId: user.id,
      projectId: project.id,
      status: data.status,
    })
})
