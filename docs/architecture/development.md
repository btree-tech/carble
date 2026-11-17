# 開発・テスト

全体像は [overview.md](overview.md)。

## 開発環境

まず `.env.example` をコピーして `.env` を作り、ファイル内のコメントを参考に `BETTER_AUTH_SECRET` と `GOOGLE_CLIENT_ID`・`GOOGLE_CLIENT_SECRET` を設定する。Google の OAuth クライアントには、リダイレクト URI として `{BETTER_AUTH_URL}/api/auth/callback/google`（手元なら `http://localhost:3000/api/auth/callback/google`）を登録しておく。

| 動かし方 | 手順 | 向いている用途 |
|---|---|---|
| Docker Compose | `docker-compose up` | 本番と同じイメージ（`NODE_ENV=production`）で動作を確かめる。DB は `storage/prod.db` |
| VS Code の Dev Containers | Dev Containers 拡張を入れ、「Dev Containers: Reopen in Container」。ターミナルで `pnpm dev` | 開発。コンテナの起動時に `pnpm install` し、`.env` を読み込む |
| Docker を使わない | `pnpm install` のあと `pnpm dev`（pnpm が無ければ `npm install -g pnpm`） | 開発 |

`pnpm dev` は、アプリ（`nuxt dev`）と DB のパッケージ（マイグレーションを適用してから Drizzle Studio を起動）を並べて動かす。

- アプリ: http://localhost:3000
- DB の中身を見る（Drizzle Studio）: https://local.drizzle.studio （ポート 4983）
- DB は `storage/dev.db`、ファイルは `storage/uploads/`（`DB_PATH` で DB の場所を変えられる）

## よく使うコマンド

プロジェクトのルートで実行する。

| コマンド | 内容 |
|---|---|
| `pnpm dev` | 開発サーバーと Drizzle Studio を起動する |
| `pnpm build` | アプリをビルドする（`packages/app/.output/`） |
| `pnpm --filter @carble/app lint` | ESLint（`lint:fix` で直せるものを直す） |
| `pnpm --filter @carble/db generate` | テーブル定義の変更からマイグレーションを作る |
| `pnpm --filter @carble/db migrate` | マイグレーションを適用する |
| `pnpm auth:generate` | Better Auth のテーブル定義（`packages/db/lib/schema/auth.ts`）を作り直す。Better Auth の版を上げたときやプラグインを変えたとき |
| `pnpm cli basicAuthUser.ts <generate\|clean>` | 管理用のコマンド（[CLI](#cli)） |

## テスト

自動テストは、画面の E2E テスト（[tests/e2e](../../tests/e2e/README.md)）だけ。Docker で本番と同じイメージのアプリを動かし、Playwright で確かめる。導入の経緯は [plans/e2e-test](../plans/e2e-test/plan.md) にある。

```bash
pnpm test:e2e                            # 環境を起動し、全テストを流し、後片付けまで行う
pnpm test:e2e specs/pages/login.spec.ts  # 引数は playwright test にそのまま渡る
```

- 画面の E2E テストは、仕様書（[product-spec/](../product-spec/README.md)）の項目に対応して書く
- 既知の問題（[ISSUES.md](../ISSUES.md)）は「【既知の問題】」のテストで今の挙動を確かめる。直したら期待値を変える

## DB のマイグレーション

- テーブル定義は `packages/db/lib/schema/`（`index.ts` がアプリのテーブル、`auth.ts` が Better Auth のテーブル）
- 定義を変えたら `pnpm --filter @carble/db generate` で `packages/db/migrations/` にマイグレーションを足し、一緒にコミットする
- 適用するタイミング
  - 手元: `pnpm dev` の起動時
  - Docker のイメージ: コンテナの起動時（`run.sh` が `npm run migrate` してからサーバーを起動する）

## CLI

`packages/cli/basicAuthUser.ts`。`--dbPath`・`--storagePath` で対象を変えられる（既定は `DB_PATH`、無ければ `storage/dev.db`・`storage/`）。

| サブコマンド | 内容 |
|---|---|
| `generate --count=<数>` | プロジェクトを指定した数（既定 100）だけ作り、それぞれに項目「みだし」「メモ」を作る。プロジェクトごとのユーザー名（`project-<ID>`）とランダムなパスワードを `storage/basicauth-users.json` に足し、`packages/cli/basicauth-users.csv` に書き出す |
| `clean` | `basicauth-users.json` に載っているプロジェクトを削除し、ファイルを消す |

- 今のアプリは `basicauth-users.json` を読まない（Basic 認証は `NUXT_BASIC_AUTH_*` の 1 組だけ）
- `generate` で作ったプロジェクトにはオーナーもメンバーもいないため、画面からは開けない
- Docker のイメージでは `/carble/cli` に置いてある

## ブランチ

- リモートは Bitbucket（`origin`）と GitHub（`gh`）
- `master`: 本番。`develop` からプルリクエストでマージする
- `develop`: 開発のまとめ先
- 作業ブランチは JIRA の課題番号（例: `CESCHI-248`）で切り、`develop` へプルリクエストでマージする
