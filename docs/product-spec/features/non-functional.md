# 非機能要件

## ユーザーストーリー（Why）

- 研究者が、PC やタブレットのブラウザから使うことで、紙のカードを撮影したり、画像を見ながら書き写したりしたい（CESCHI-86）
- 運営者が、公開前の環境やワークショップ用の環境に Basic 認証をかけることで、関係者以外に見せないようにしたい（推測、確信度: 高）
- 運営者が、Docker だけでサーバーを動かすことで、設置する環境を選ばずに済むようにしたい（CESCHI-86）

## 外部仕様（What）

### 動作環境

- 次のブラウザで動作する

| OS | ブラウザ |
|---|---|
| macOS | Safari・Chrome の最新版 |
| Windows 10 / 11 | Chrome の最新版 |
| iPadOS | Safari の最新版 |
| Android | Chrome の最新版 |
| （共通） | Firefox の最新版 |

- [スキャン](scan.md)でカメラを使うには、カメラのある端末が要る
- インターネットに接続できること（Google でのログインに使う）
- サーバーは Docker で動作する

### 自動保存

- 入力した値は、入力が止まってから 1 秒後に保存する（[画面共通](common-layout.md#保存状態のアイコン)）

### インポートの処理

- インポートは、毎分 0 秒に動く処理が、すべてのプロジェクトを通じて 1 件ずつ取り込む（[インポート・エクスポート](import-export.md#インポート)）
  - 取り込みに 1 分以上かかる場合、終わるまで次のインポートは始めない
- アップロードできるファイルの大きさは、アプリでは制限しない。サーバーの前に置くリバースプロキシの設定（このリポジトリの外）で決まる

### 画像の表示

- 画像は、元の画像とは別に、長辺 640px 以内に縮小した画像（WebP）を、初めて表示するときに作って表示する。元の画像より大きくはしない

### Basic 認証

- **WHERE** 環境変数 `NUXT_BASIC_AUTH_USER`・`NUXT_BASIC_AUTH_PASSWORD` の両方を設定した場合、すべての画面と API に Basic 認証をかける
  - 死活監視用の `/api/health` には Basic 認証をかけない
- 既定値は設定なし（Basic 認証をかけない）

### サーバーの設定

- 次の環境変数で設定する

| 環境変数 | 内容 | 既定値 |
|---|---|---|
| `NUXT_PORT` | 待ち受けるポート（Docker Compose の場合） | `3000` |
| `NUXT_BASIC_AUTH_USER`・`NUXT_BASIC_AUTH_PASSWORD` | Basic 認証のユーザー名・パスワード | 設定なし |
| `BETTER_AUTH_SECRET`・`BETTER_AUTH_URL` | ログインの署名に使う秘密の文字列・設置する URL | 設定なし |
| `GOOGLE_CLIENT_ID`・`GOOGLE_CLIENT_SECRET` | Google でのログインに使うキー | 設定なし |
| `DB_PATH` | SQLite のファイルの場所 | Docker の場合 `/carble/storage/prod.db`、Docker を使わない場合 `storage/dev.db` |

- **WHERE** Docker で動かす場合、**WHEN** サーバーを起動すると、DB のマイグレーションを実行してからアプリを起動する

### データの保存場所

- データは、サーバーの `storage/`（Docker の場合 `/carble/storage`。ボリュームにする）に置く SQLite のファイルに保存する
- 画像とアップロードしたインポートのファイルは、サーバーの `storage/uploads/` に保存する
  - 画像は `public/images/`、縮小した画像は `public/thumbs/`、インポートのファイルは `imports/` に置く
  - インポートのファイルは、取り込みが終わると（エラーの場合も）消す
- インポートの zip は、サーバーの一時フォルダ（OS の既定の一時フォルダ）に展開し、取り込みが終わると消す

## 補足情報

### 実装との乖離

- 動作環境の各ブラウザでの動作は未調査（画面の E2E テストは Chromium だけで流す）

### 関連機能

- [画面共通](common-layout.md)
- [インポート・エクスポート](import-export.md)

### 変更履歴

- [CESCHI-172](https://kinako.atlassian.net/browse/CESCHI-172) 画像のアップロードの上限を引き上げた（リバースプロキシの設定。このリポジトリの外）
- [CESCHI-113](https://kinako.atlassian.net/browse/CESCHI-113) 画像を縮小して表示し、表示を速くした
- Confluence「仕様」から移植
