defineRouteMeta({
  openAPI: {
    tags: ['system'],
    summary: '稼働の確認',
    // 入力: [場所, 名前, 型, 必須, 内容]
    'x-input': [
    ],
    // 処理: [条件, 処理]
    'x-process': [
    ],
    // 出力: [状態, 条件, 本文]
    'x-output': [
      ['200', '（常に）', 'ok'],
    ],
    // エラー: [状態, 条件]（ログイン・メンバー・ロールによるものは docs/product-spec/features/roles.md）
    'x-errors': [
    ],
  },
})

export default defineEventHandler(async () => {
  return 'ok'
})
