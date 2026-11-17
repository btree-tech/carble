import { usersToProjects } from '@carble/db/schema'

defineRouteMeta({
  openAPI: {
    tags: ['projects'],
    summary: 'プロジェクトの一覧',
    // 入力: [場所, 名前, 型, 必須, 内容]
    'x-input': [
      ['クエリ', 'status', 'invited', '任意', '自分を招待しているプロジェクトを返す'],
    ],
    // 処理: [条件, 処理]
    'x-process': [
      ['status が無い', '自分がメンバー（招待中を除く）のプロジェクトを取得する'],
      ['status が invited', '自分を招待しているプロジェクトを取得する'],
      ['（常に）', '最終更新日時の新しい順に並べる'],
    ],
    // 出力: [状態, 条件, 本文]
    'x-output': [
      ['200', '（常に）', 'プロジェクトの配列。各プロジェクトに、オーナーの名前（users）と、取り込み待ち・取り込み中のインポート（imports。あれば 1 件）を付ける'],
    ],
    // エラー: [状態, 条件]（ログイン・メンバー・ロールによるものは docs/product-spec/features/roles.md）
    'x-errors': [
      ['400', 'status が invited 以外'],
    ],
  },
})

export default defineEventHandler(async (event) => {
  const user = await useSessionUser()

  const data = await getValidatedQuery(
    event,
    createSelectSchema(usersToProjects, {
      status: (s) => s.nullable().default(null),
    }).pick({
      status: true,
    }).parse,
  )

  return useDatabase().transaction(async (tx) => {
    const projetIds = await tx.query.usersToProjects.findMany({
      where: ({ userId, status }, { and, eq, isNull }) => and(
        eq(userId, user.id),
        data.status ? eq(status, data.status) : isNull(status),
      ),
    })

    return await tx.query.projects.findMany({
      where: ({ id }, { inArray }) => inArray(id, projetIds.map(({ projectId }) => projectId)),
      orderBy: ({ updatedAt }, { desc }) => desc(updatedAt),
      with: {
        users: {
          where: ({ role }, { eq }) => eq(role, 'owner'),
          limit: 1,
          with: {
            user: {
              columns: {
                name: true,
              },
            },
          },
        },
        imports: {
          where: ({ status }, { inArray }) => inArray(status, ['OPEN', 'IN_PROGRESS']),
          limit: 1,
        },
      },
    })
  })
})
