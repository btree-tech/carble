defineRouteMeta({
  openAPI: {
    tags: ['system'],
    summary: '印刷のレイアウトの取得',
    // 入力: [場所, 名前, 型, 必須, 内容]
    'x-input': [
      ['パス', 'layoutId', '整数', '必須', 'レイアウトの ID'],
    ],
    // 処理: [条件, 処理]
    'x-process': [
      ['（常に）', 'layoutId のレイアウトの定義を取得する'],
    ],
    // 出力: [状態, 条件, 本文]
    'x-output': [
      ['200', '（常に）', 'レイアウトの定義'],
    ],
    // エラー: [状態, 条件]（ログイン・メンバー・ロールによるものは docs/product-spec/features/roles.md）
    'x-errors': [
      ['404', 'layoutId のレイアウトが無い'],
    ],
  },
})

export default defineEventHandler(async () => {
  return findPrintViewLayout()
})
