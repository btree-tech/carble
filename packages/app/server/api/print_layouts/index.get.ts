defineRouteMeta({
  openAPI: {
    tags: ['system'],
    summary: '印刷のレイアウトの一覧',
    // 入力: [場所, 名前, 型, 必須, 内容]
    'x-input': [
    ],
    // 処理: [条件, 処理]
    'x-process': [
      ['（常に）', 'カード印刷ビューのレイアウトの定義をすべて取得する'],
    ],
    // 出力: [状態, 条件, 本文]
    'x-output': [
      ['200', '（常に）', 'レイアウトの定義の配列'],
    ],
    // エラー: [状態, 条件]（ログイン・メンバー・ロールによるものは docs/product-spec/features/roles.md）
    'x-errors': [
    ],
  },
})

export default defineEventHandler(async () => {
  return getPrintViewLayouts()
})
