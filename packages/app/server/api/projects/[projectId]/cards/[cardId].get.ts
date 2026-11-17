defineRouteMeta({
  openAPI: {
    tags: ['cards'],
    summary: 'カードの取得',
    // 入力: [場所, 名前, 型, 必須, 内容]
    'x-input': [
      ['パス', 'projectId', '整数', '必須', 'プロジェクトの ID'],
      ['パス', 'cardId', '整数', '必須', 'カードの ID'],
    ],
    // 処理: [条件, 処理]
    'x-process': [
      ['（常に）', 'カードを取得する'],
    ],
    // 出力: [状態, 条件, 本文]
    'x-output': [
      ['200', '（常に）', 'カード。値（contents）と画像（images。追加した順）を付ける'],
    ],
    // エラー: [状態, 条件]（ログイン・メンバー・ロールによるものは docs/product-spec/features/roles.md）
    'x-errors': [
      ['404', 'cardId のカードがプロジェクトに無い'],
      ['409', 'プロジェクトに取り込み待ち・取り込み中のインポートがある'],
    ],
  },
})

export default defineEventHandler(async () => {
  return await findCard({
    contents: true,
    images: {
      orderBy: ({ createdAt }, { asc }) => asc(createdAt),
    },
  })
})
