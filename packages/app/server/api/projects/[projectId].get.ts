defineRouteMeta({
  openAPI: {
    tags: ['projects'],
    summary: 'プロジェクトの取得',
    // 入力: [場所, 名前, 型, 必須, 内容]
    'x-input': [
      ['パス', 'projectId', '整数', '必須', 'プロジェクトの ID'],
    ],
    // 処理: [条件, 処理]
    'x-process': [
      ['（常に）', 'プロジェクトを取得する'],
    ],
    // 出力: [状態, 条件, 本文]
    'x-output': [
      ['200', '（常に）', 'プロジェクト。項目（fields。並び順）・カードの ID の一覧（cards）・自分のロール（users）を付ける'],
    ],
    // エラー: [状態, 条件]（ログイン・メンバー・ロールによるものは docs/product-spec/features/roles.md）
    'x-errors': [
    ],
  },
})

export default defineEventHandler(async () => {
  const sessionUser = await useSessionUser()

  return await findProject({
    fields: {
      orderBy: ({ order }, { asc }) => asc(order),
    },
    cards: {
      columns: {
        id: true,
      },
    },
    users: {
      columns: {
        role: true,
      },
      where: ({ userId }, { eq }) => eq(userId, sessionUser.id),
      limit: 1,
    },
  })
})
