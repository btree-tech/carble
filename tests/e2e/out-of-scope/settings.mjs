// プロジェクト設定・インポート/エクスポート・非機能要件のうち、画面のテストで確かめない項目

const BROWSERS = 'runner には Linux の Chromium しか入っておらず、この OS・ブラウザでは流さない。画面のテストは Chromium の PC 幅（desktop）とスマホ幅のエミュレーション（Pixel 7）だけで確かめる'
const ENV = '環境変数・既定値はサーバーの設定で、画面に現れない。テストの中から app の環境変数を変えて起動し直すこともできない'

export default [
  {
    item: 'features/non-functional.md > 動作環境 > macOS | Safari・Chrome の最新版',
    category: 'device',
    reason: BROWSERS,
  },
  {
    item: 'features/non-functional.md > 動作環境 > Windows 10 / 11 | Chrome の最新版',
    category: 'device',
    reason: BROWSERS,
  },
  {
    item: 'features/non-functional.md > 動作環境 > iPadOS | Safari の最新版',
    category: 'device',
    reason: BROWSERS,
  },
  {
    item: 'features/non-functional.md > 動作環境 > Android | Chrome の最新版',
    category: 'device',
    reason: BROWSERS,
  },
  {
    item: 'features/non-functional.md > 動作環境 > （共通） | Firefox の最新版',
    category: 'device',
    reason: BROWSERS,
  },
  {
    item: 'features/non-functional.md > サーバーの設定 > NUXT_PORT',
    category: 'infra',
    reason: ENV,
  },
  {
    item: 'features/non-functional.md > サーバーの設定 > NUXT_BASIC_AUTH_USER',
    category: 'infra',
    reason: ENV,
  },
  {
    item: 'features/non-functional.md > サーバーの設定 > BETTER_AUTH_SECRET',
    category: 'infra',
    reason: ENV,
  },
  {
    item: 'features/non-functional.md > サーバーの設定 > GOOGLE_CLIENT_ID',
    category: 'infra',
    reason: ENV,
  },
  {
    item: 'features/non-functional.md > サーバーの設定 > DB_PATH',
    category: 'infra',
    reason: ENV,
  },
  {
    item: 'features/non-functional.md > 動作環境 > 次のブラウザで動作する',
    category: 'device',
    reason: 'runner には Linux の Chromium しか入っておらず、Safari・Firefox・各 OS（macOS・Windows・iPadOS・Android 実機）では流さない。画面のテストは Chromium の PC 幅（desktop）とスマホ幅のエミュレーション（Pixel 7）だけで確かめる',
  },
  {
    item: 'features/non-functional.md > 動作環境 > スキャンでカメラを使うには、カメラのある端末が要る',
    category: 'device',
    reason: 'カメラの有無は端末の条件で、テストのブラウザにはカメラが無い（スキャンは画像のファイルを選んで確かめる）',
  },
  {
    item: 'features/non-functional.md > 動作環境 > インターネットに接続できること（Google でのログインに使う）',
    category: 'external',
    reason: 'Google でのログインは外部のサービスで、E2E の環境はインターネットの Google に接続しない（ログイン状態は DB に直接作る）',
  },
  {
    item: 'features/non-functional.md > インポートの処理 > インポートは、毎分 0 秒に動く処理が > 取り込みに 1 分以上かかる場合、終わるまで次のインポートは始めない',
    category: 'infra',
    reason: '1 分以上かかる取り込みを作るには巨大なファイルが要り、その間は全体の取り込み（他のテストのインポート）が止まる。1 件ずつ・古い順に取り込むこと（前が終わるまで次は未処理のまま）は import-export.import.spec.ts で確かめる',
  },
  {
    item: 'features/non-functional.md > インポートの処理 > アップロードできるファイルの大きさは、アプリでは制限しない',
    category: 'infra',
    reason: '上限はサーバーの前に置くリバースプロキシ（このリポジトリの外）で決まり、E2E の環境にはリバースプロキシが無い。大きなファイルを送って確かめると時間とディスクを使うだけで、画面の違いは出ない',
  },
  {
    item: 'features/non-functional.md > Basic 認証 > WHERE 環境変数 NUXT_BASIC_AUTH_USER・NUXT_BASIC_AUTH_PASSWORD の両方を設定した場合',
    category: 'infra',
    reason: 'app の環境変数はテストの中から変えられず、E2E の app は Basic 認証を設定していない（docker-compose.e2e.yml。設定すると他のすべてのテストに認証が要る）。設定しない既定の挙動は non-functional.spec.ts で確かめる',
  },
  {
    item: 'features/non-functional.md > サーバーの設定 > 次の環境変数で設定する',
    category: 'infra',
    reason: '環境変数・既定値はサーバーの設定で、画面に現れない。テストの中から app の環境変数を変えて起動し直すこともできない（起動時のマイグレーションは non-functional.spec.ts で、まっさらな DB の app が動くことで確かめる）',
  },
  {
    item: 'features/non-functional.md > データの保存場所 > データは、サーバーの storage/',
    category: 'infra',
    reason: 'サーバーのファイルの置き場所で、画面に現れない',
  },
  {
    item: 'features/non-functional.md > データの保存場所 > 画像とアップロードしたインポートのファイルは、サーバーの storage/uploads/ に保存する',
    category: 'infra',
    reason: 'サーバーのファイルの置き場所と、取り込み後に消すかどうかで、画面に現れない（画像の表示・縮小・プロジェクト削除で画像のファイルが消えることは、画面と共有のボリュームで確かめる）',
  },
  {
    item: 'features/non-functional.md > データの保存場所 > インポートの zip は、サーバーの一時フォルダ',
    category: 'infra',
    reason: 'app のコンテナの中の一時フォルダで、画面にも runner と共有のボリュームにも現れない',
  },
]
