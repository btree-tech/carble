// カード入力ビュー・グリッドビュー・カード印刷ビュー・スキャンのうち、画面のテストで確かめない項目

export default [
  {
    item: 'pages/card-view.md > 画像 > 「画像を追加」ボタンを表示する > WHEN 「画像を追加」を押すと > WHERE スマホ・タブレットの場合',
    category: 'device',
    reason: 'カメラの起動は端末の OS が行い、テストのブラウザでは起きない。画像を選ぶ画面が開くこと・選んだ画像を追加することは card-view.spec.ts で確かめる',
  },
  {
    item: 'features/scan.md > WHEN 「スキャン」を押すと、画像を選ぶ画面を開く > WHERE スマホ・タブレットの場合',
    category: 'device',
    reason: 'カメラの起動は端末の OS が行い、テストのブラウザでは起きない。画像を選ぶ画面が開くことは scan.spec.ts・scan.mobile.spec.ts で確かめる',
  },
  {
    item: 'pages/print-view.md > 印刷 > WHEN 「印刷」を押すと、ブラウザの印刷のダイアログを開く',
    category: 'device',
    reason: '印刷のダイアログはブラウザが開く OS の画面で、ヘッドレスのブラウザでは開かない（製品のコードを置き換えて window.print を見張ることもしない）。印刷する内容（A4 縦に 2 枚ずつ・ヘッダーと設定を印刷しない）は、子の項目として print-view.spec.ts で印刷用のメディアと PDF で確かめる',
  },
]
