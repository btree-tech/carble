# 非機能要件

仕様: [features/non-functional.md](/docs/product-spec/features/non-functional.md)

## テスト設計（ユーザーストーリー）

| ID | ストーリー | 層 |
|---|---|---|
| TC-FT-NFR-US1 | 研究者が、PC・タブレット・スマホのどれからでも使うことで、資料のある場所で記録したい | ブラウザ E2E |
| TC-FT-NFR-US2 | 運営者が、公開前の環境やワークショップ用の環境に Basic 認証をかけることで、関係者以外に見せないようにしたい | ブラウザ E2E |
| TC-FT-NFR-US3 | 運営者が、Docker だけでサーバーを動かすことで、設置と保守を簡単にしたい | ブラウザ E2E |

- `対象外` `手段なし` TC-FT-NFR-US2: E2E の app は Basic 認証の環境変数を設定していない（設定すると他のすべてのテストに認証が要る）。Basic 認証をかけた環境で人が確かめる

## テスト設計（外部仕様）

### 動作環境

| ID | 結果 | 層 |
|---|---|---|
| TC-FT-NFR-ENV1 | 次のブラウザで動作する | ブラウザ E2E |
| TC-FT-NFR-ENV2 | スキャンでカメラを使うには、カメラのある端末が要る | ブラウザ E2E |
| TC-FT-NFR-ENV3 | インターネットに接続できること（Google でのログインに使う） | ブラウザ E2E |
| TC-FT-NFR-ENV4 | サーバーは Docker で動作する | ブラウザ E2E |

- `対象外` `手段なし` TC-FT-NFR-ENV1: runner には Linux の Chromium しか入っておらず、Safari・Firefox・各 OS（macOS・Windows・iPadOS・Android 実機）では流さない。画面のテストは Chromium の PC 幅（desktop）とスマホ幅のエミュレーション（Pixel 7）だけで確かめる
- `対象外` `手段なし` TC-FT-NFR-ENV2: カメラの有無は端末の条件で、テストのブラウザにはカメラが無い（スキャンは画像のファイルを選んで確かめる）
- `対象外` `手段なし` TC-FT-NFR-ENV3: Google でのログインは外部のサービスで、E2E の環境はインターネットの Google に接続しない（ログイン状態は DB に直接作る）

| ID | OS | ブラウザ | 層 |
|---|---|---|---|
| TC-FT-NFR-ENV5 | macOS | Safari・Chrome の最新版 | ブラウザ E2E |
| TC-FT-NFR-ENV6 | Windows 10 / 11 | Chrome の最新版 | ブラウザ E2E |
| TC-FT-NFR-ENV7 | iPadOS | Safari の最新版 | ブラウザ E2E |
| TC-FT-NFR-ENV8 | Android | Chrome の最新版 | ブラウザ E2E |
| TC-FT-NFR-ENV9 | （共通） | Firefox の最新版 | ブラウザ E2E |

- `対象外` `手段なし` TC-FT-NFR-ENV5: runner には Linux の Chromium しか入っておらず、この OS・ブラウザでは流さない。画面のテストは Chromium の PC 幅（desktop）とスマホ幅のエミュレーション（Pixel 7）だけで確かめる
- `対象外` `手段なし` TC-FT-NFR-ENV6: runner には Linux の Chromium しか入っておらず、この OS・ブラウザでは流さない。画面のテストは Chromium の PC 幅（desktop）とスマホ幅のエミュレーション（Pixel 7）だけで確かめる
- `対象外` `手段なし` TC-FT-NFR-ENV7: runner には Linux の Chromium しか入っておらず、この OS・ブラウザでは流さない。画面のテストは Chromium の PC 幅（desktop）とスマホ幅のエミュレーション（Pixel 7）だけで確かめる
- `対象外` `手段なし` TC-FT-NFR-ENV8: runner には Linux の Chromium しか入っておらず、この OS・ブラウザでは流さない。画面のテストは Chromium の PC 幅（desktop）とスマホ幅のエミュレーション（Pixel 7）だけで確かめる
- `対象外` `手段なし` TC-FT-NFR-ENV9: runner には Linux の Chromium しか入っておらず、この OS・ブラウザでは流さない。画面のテストは Chromium の PC 幅（desktop）とスマホ幅のエミュレーション（Pixel 7）だけで確かめる

### 自動保存

| ID | 結果 | 層 |
|---|---|---|
| TC-FT-NFR-AUTO1 | 入力した値は、入力が止まってから 1 秒後に保存する（画面共通） | ブラウザ E2E |

### インポートの処理

| ID | 結果 | 層 |
|---|---|---|
| TC-FT-NFR-IMP1 | インポートは、毎分 0 秒に動く処理が、すべてのプロジェクトを通じて 1 件ずつ取り込む（インポート・エクスポート） | ブラウザ E2E |
| TC-FT-NFR-IMP2 | 取り込みに 1 分以上かかる場合、終わるまで次のインポートは始めない | ブラウザ E2E |
| TC-FT-NFR-IMP3 | アップロードできるファイルの大きさは、アプリでは制限しない。サーバーの前に置くリバースプロキシの設定（このリポジトリの外）で決まる | ブラウザ E2E |

- `対象外` `手段なし` TC-FT-NFR-IMP2: 1 分以上かかる取り込みを作るには巨大なファイルが要り、その間は全体の取り込み（他のテストのインポート）が止まる。1 件ずつ・古い順に取り込むこと（前が終わるまで次は未処理のまま）は import-export.import.spec.ts で確かめる
- `対象外` `手段なし` TC-FT-NFR-IMP3: 上限はサーバーの前に置くリバースプロキシ（このリポジトリの外）で決まり、E2E の環境にはリバースプロキシが無い。大きなファイルを送って確かめると時間とディスクを使うだけで、画面の違いは出ない

### 画像の表示

| ID | 結果 | 層 |
|---|---|---|
| TC-FT-NFR-IMG1 | 画像は、元の画像とは別に、長辺 640px 以内に縮小した画像（WebP）を、初めて表示するときに作って表示する。元の画像より大きくはしない | ブラウザ E2E |

### Basic 認証

| ID | 前提（WHERE） | 結果 | 層 |
|---|---|---|---|
| TC-FT-NFR-AUTH1 | 環境変数 NUXT_BASIC_AUTH_USER・NUXT_BASIC_AUTH_PASSWORD の両方を設定した場合 | すべての画面と API に Basic 認証をかける | ブラウザ E2E |
| TC-FT-NFR-AUTH2 | 環境変数 NUXT_BASIC_AUTH_USER・NUXT_BASIC_AUTH_PASSWORD の両方を設定した場合 | 死活監視用の /api/health には Basic 認証をかけない | ブラウザ E2E |
| TC-FT-NFR-AUTH3 |  | 既定値は設定なし（Basic 認証をかけない） | ブラウザ E2E |

- `対象外` `手段なし` TC-FT-NFR-AUTH1: app の環境変数はテストの中から変えられず、E2E の app は Basic 認証を設定していない（docker-compose.e2e.yml。設定すると他のすべてのテストに認証が要る）。設定しない既定の挙動は non-functional.spec.ts で確かめる
- `対象外` `手段なし` TC-FT-NFR-AUTH2: E2E の app は Basic 認証の環境変数を設定していない（Basic 認証をかけない既定値を TC-FT-NFR-AUTH3 で確かめるため）。Basic 認証をかけた環境で `/api/health` を開いて確かめる

### サーバーの設定

| ID | 前提（WHERE） | 操作（WHEN） | 結果 | 層 |
|---|---|---|---|---|
| TC-FT-NFR-CONF1 |  |  | 次の環境変数で設定する | ブラウザ E2E |
| TC-FT-NFR-CONF2 | Docker で動かす場合 | サーバーを起動すると | DB のマイグレーションを実行してからアプリを起動する | ブラウザ E2E |

- `対象外` `手段なし` TC-FT-NFR-CONF1: 環境変数・既定値はサーバーの設定で、画面に現れない。テストの中から app の環境変数を変えて起動し直すこともできない（起動時のマイグレーションは non-functional.spec.ts で、まっさらな DB の app が動くことで確かめる）

| ID | 環境変数 | 内容 | 既定値 | 層 |
|---|---|---|---|---|
| TC-FT-NFR-CONF3 | NUXT_PORT | 待ち受けるポート（Docker Compose の場合） | 3000 | ブラウザ E2E |
| TC-FT-NFR-CONF4 | NUXT_BASIC_AUTH_USER・NUXT_BASIC_AUTH_PASSWORD | Basic 認証のユーザー名・パスワード | 設定なし | ブラウザ E2E |
| TC-FT-NFR-CONF5 | BETTER_AUTH_SECRET・BETTER_AUTH_URL | ログインの署名に使う秘密の文字列・設置する URL | 設定なし | ブラウザ E2E |
| TC-FT-NFR-CONF6 | GOOGLE_CLIENT_ID・GOOGLE_CLIENT_SECRET | Google でのログインに使うキー | 設定なし | ブラウザ E2E |
| TC-FT-NFR-CONF7 | DB_PATH | SQLite のファイルの場所 | Docker の場合 /carble/storage/prod.db、Docker を使わない場合 storage/dev.db | ブラウザ E2E |

- `対象外` `手段なし` TC-FT-NFR-CONF3: 環境変数・既定値はサーバーの設定で、画面に現れない。テストの中から app の環境変数を変えて起動し直すこともできない
- `対象外` `手段なし` TC-FT-NFR-CONF4: 環境変数・既定値はサーバーの設定で、画面に現れない。テストの中から app の環境変数を変えて起動し直すこともできない
- `対象外` `手段なし` TC-FT-NFR-CONF5: 環境変数・既定値はサーバーの設定で、画面に現れない。テストの中から app の環境変数を変えて起動し直すこともできない
- `対象外` `手段なし` TC-FT-NFR-CONF6: 環境変数・既定値はサーバーの設定で、画面に現れない。テストの中から app の環境変数を変えて起動し直すこともできない
- `対象外` `手段なし` TC-FT-NFR-CONF7: 環境変数・既定値はサーバーの設定で、画面に現れない。テストの中から app の環境変数を変えて起動し直すこともできない

### データの保存場所

| ID | 結果 | 層 |
|---|---|---|
| TC-FT-NFR-DATA1 | データは、サーバーの storage/（Docker の場合 /carble/storage。ボリュームにする）に置く SQLite のファイルに保存する | ブラウザ E2E |
| TC-FT-NFR-DATA2 | 画像とアップロードしたインポートのファイルは、サーバーの storage/uploads/ に保存する | ブラウザ E2E |
| TC-FT-NFR-DATA3 | 画像は public/images/、縮小した画像は public/thumbs/、インポートのファイルは imports/ に置く | ブラウザ E2E |
| TC-FT-NFR-DATA4 | インポートのファイルは、取り込みが終わると（エラーの場合も）消す | ブラウザ E2E |
| TC-FT-NFR-DATA5 | インポートの zip は、サーバーの一時フォルダ（OS の既定の一時フォルダ）に展開し、取り込みが終わると消す | ブラウザ E2E |

- `対象外` `手段なし` TC-FT-NFR-DATA1: サーバーのファイルの置き場所で、画面に現れない
- `対象外` `手段なし` TC-FT-NFR-DATA2: サーバーのファイルの置き場所と、取り込み後に消すかどうかで、画面に現れない（画像の表示・縮小・プロジェクト削除で画像のファイルが消えることは、画面と共有のボリュームで確かめる）
- `対象外` `手段なし` TC-FT-NFR-DATA5: app のコンテナの中の一時フォルダで、画面にも runner と共有のボリュームにも現れない
