defineRouteMeta({
  openAPI: {
    tags: ['system'],
    summary: '認証',
    // 入力: [場所, 名前, 型, 必須, 内容]
    'x-input': [
      ['パス', 'all', '文字列', '必須', '認証のライブラリ（Better Auth）の経路'],
    ],
    // 処理: [条件, 処理]
    'x-process': [
      ['（常に）', '認証のライブラリが、ログイン・ログアウト・ユーザーの登録と削除を処理する（ログイン・ユーザー登録・設定（ユーザー）の仕様）'],
    ],
    // 出力: [状態, 条件, 本文]
    'x-output': [
      ['（ライブラリが決める）', '（常に）', '（ライブラリが決める）'],
    ],
    // エラー: [状態, 条件]（ログイン・メンバー・ロールによるものは docs/product-spec/features/roles.md）
    'x-errors': [
    ],
  },
})

export default defineEventHandler((event) => {
	return auth.handler(toWebRequest(event))
})
