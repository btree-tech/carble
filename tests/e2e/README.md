# 画面の E2E テスト（tests/e2e）

`docs/product-spec` の外部仕様のうち、画面に現れるもの（表示・操作・遷移）を、本番と同じイメージで動かしたアプリで確かめる Playwright のテスト。

画面で観測できないサーバーの応答（権限の確認など）は、ブラウザを使わずに API を直接呼ぶテスト（`*.api.spec.ts`。テスト設計の層 `API E2E`）で確かめる。

## 動かし方

Docker だけあれば動く。手元の Node は使わない。

```bash
pnpm test:e2e                                  # 環境を起動し、全テストを流し、後片付けまで行う
pnpm test:e2e specs/pages/login.spec.ts        # 引数は playwright test にそのまま渡る
pnpm test:e2e --project=desktop -g "招待"

# テストだけ直したとき（製品のコードを変えたら E2E_SKIP_BUILD は付けない）
E2E_SKIP_BUILD=1 pnpm test:e2e specs/pages/login.spec.ts
# 環境を残して続けて流す。止めるときは E2E_DOWN=1
E2E_KEEP=1 E2E_SKIP_BUILD=1 pnpm test:e2e
E2E_DOWN=1 pnpm test:e2e
# 別の環境として同時に動かす（プロジェクト名を分ける）
E2E_PROJECT=carble-e2e-a E2E_SKIP_BUILD=1 pnpm test:e2e specs/pages/table-view.spec.ts
```

結果は `tests/e2e/playwright-report/`（html）と `tests/e2e/test-results/`（失敗したテストのスクリーンショット・動画・trace・画面の内容）に、app のログは `tests/e2e/compose-logs/compose.log` に出る。

### カバレッジ

```bash
E2E_COVERAGE=1 pnpm test:e2e                   # 全テストを流し、tests/e2e/coverage/index.html にレポートを作る
E2E_COVERAGE=1 pnpm test:e2e specs/features/card-duplicate.spec.ts
```

- `docker-compose.e2e.coverage.yml` を重ね、app をソースマップ付きの別のイメージ（`carble-e2e-app-coverage`）にする。付けないときは、今までどおり本番と同じイメージで流す
- GitHub Actions では、本番と同じイメージで流すジョブ（`e2e`）と並べて、カバレッジのジョブ（`coverage`）を流す（下の「GitHub Actions」）
- ブラウザ側は、fixture の `pageAs` で開いた画面ごとに Chromium のカバレッジを集める（`support/coverage.ts`）。サーバー側は app の `NODE_V8_COVERAGE` で集め、テストの後に app を止めて書き出させる
- `scripts/coverage-report.mjs` が両方を合わせ、ソースマップで `packages/app` のファイルの行に対応づける（`lcov.info` も出す）
- テストの中で別に開いたタブ（印刷の確認用など）は数えない
- 一度も読み込まれなかったファイル（開かなかった画面・呼ばなかった API など）も、ビルドしたファイルから 0% としてレポートに出す。どこからも使われずビルドに入らなかったファイルは出ない
- 画面のコードは、ブラウザで動いた分とサーバーで描いた分（SSR）を合わせて数える
- ソースマップに本文が無いファイル（サーバーの API など）は、リポジトリのファイルで補う。製品のコードを変えたら `E2E_SKIP_BUILD` を付けずに流す（古いイメージだと行がずれる）

### 環境（docker-compose.e2e.yml）

```
runner（Playwright）─→ app（本番と同じ Dockerfile の app ステージ。本番と同じ x64。http://carble:3000）
       └─ ログインの仕込みだけ、共有のボリュームの SQLite に直接書く
```

| サービス | 役割 |
|---|---|
| app | 本番と同じイメージ。起動時にマイグレーションする。DB とファイルはボリューム（毎回まっさら）。環境変数 `CARBLE_E2E=1` で、DB の接続だけ、ロックで失敗しないよう手を入れたもの（`packages/db/lib/e2e.ts`）に切り替える（本番の接続のままだと、並列で流すとほとんど落ちる。`docs/ISSUES.md`「同時に保存すると失敗し、DB がロックされたままになることがある」） |
| runner | テストを流す。依存は `tests/e2e/package.json` に分けてあり、このコンテナの中だけで入れる |

ホストにはポートを公開しない。ブラウザからは `http://carble:3000` で開く（サービス名の `app` は、Chrome が `.app` のドメインとして https に切り替えてしまうため使わない）。

### その他のコマンド（runner の中で動かす。app は起動しない）

```bash
docker compose -p carble-e2e -f docker-compose.e2e.yml --profile runner run --rm --no-deps runner pnpm run typecheck
docker compose -p carble-e2e -f docker-compose.e2e.yml --profile runner run --rm --no-deps runner pnpm run check:test-design
```

### GitHub Actions

[.github/workflows/e2e.yml](../../.github/workflows/e2e.yml) が、プルリクエストと `master`・`develop` への push のたびに、型の検査・テスト設計の検査・全テストを流す（手動でも動かせる）。手元と同じく `docker-compose.e2e.yml` と `scripts/run.sh` を使う。

- `CI=true` で流すので、失敗したテストは 2 回までやり直し、`test.only` が残っていると失敗にする（`playwright.config.ts`）
- 結果（`playwright-report/`・`test-results/`・`compose-logs/`）は、実行のページの artifact `e2e-report` に 14 日残す
- 並べて、カバレッジを取るジョブ（`coverage`）も流す。要約を実行のページの Summary に表で出し、レポート（`coverage/`）を artifact `e2e-coverage` に 14 日残す
- ランナーは x64 なので、app は模倣せずに動く。全体の時間は、インポートのテストの待ちでほぼ決まる

## 構成

| 場所 | 内容 |
|---|---|
| `specs/pages/*.spec.ts`、`specs/features/*.spec.ts` | テスト。仕様書（`docs/product-spec/pages`、`features`）1 本につき 1 本 |
| `specs/api/*.api.spec.ts` | API の仕様（`docs/product-spec/api/`。各 API の処理・出力・エラー）のテスト。仕様書 1 本につき 1 本 |
| `*.mobile.spec.ts` | スマホ幅（Pixel 7）で流すテスト |
| `*.api.spec.ts` | API E2E（テスト設計の層 `API E2E`）。ブラウザを使わず、fixture の `requestAs`（Playwright の `APIRequestContext`）で製品の API・ファイルの URL を直接呼び、状態コードと要求の後のデータを確かめる |
| `*.import.spec.ts` | インポートを待つテスト。毎分の定期タスクを待つので、別のプロジェクトにして順に流す |
| `pages/` | ページオブジェクト。ロケータと操作はここに置く |
| `support/db.ts` | ログインの仕込み（DB にユーザーとセッションを作り、Better Auth と同じ方式で署名した Cookie を返す） |
| `support/api.ts` | 製品の API を呼ぶ（前提データの作成） |
| `support/navigation.ts` | 画面を開き、ハイドレーションを待つ |
| `support/apiSpec.ts` | API の仕様のテストの道具（状態コードの確認、最終更新日時の更新の確認、取り込み中のインポートがある間の確認） |
| `support/spec.ts` | 既知の問題の注記（`knownIssue()`） |
| `support/imports.ts` | インポートの取り込みを待つ時間の上限 |
| `fixtures/index.ts` | テスト専用のユーザー・ログイン済みの画面・API を呼ぶ文脈（`apiAs`・`requestAs`）・オーナーとプロジェクト |
| `files/` | インポートなどで使うファイル |
| `scripts/check-test-design.mjs` | 外部仕様・テスト設計・テストの対応を確かめる（[docs/test-design/README.md](../../docs/test-design/README.md) の「検査」） |

## テストの書き方

### 原則

- 利用者に見えるもの（役割・ラベル・ボタン名・文言）で操作し、確かめる。class 属性などで確かめない
- ロケータは `getByRole`・`getByLabel`・`getByText` を使い、ページオブジェクトに置く。やむを得ず CSS セレクタを使うときは、理由をコメントに書く
- ページオブジェクトは操作とロケータを返すだけにし、`expect` はテスト本文に書く（「次に進める状態」を待つための `expect` は除く）
- 画面を開くときは `support/navigation.ts` の `open()` を使う（ハイドレーションの前に操作すると入力が消える）
- 待ち合わせに `waitForTimeout` を使わない。表示・URL など「次に進める状態」を待つ
- テストのコードで、ネットワークや製品のコードを置き換えない（`page.route` などを使わない）
- 前提データは、ログイン（`support/db.ts`）だけ DB に直接書く。それ以外は画面か製品の API（`support/api.ts`）で作る
- テストごとにユーザー・プロジェクトを作る（fixture の `owner`・`project`・`newAccount`）。データには fixture の `tag` を入れ、並列で動く他のテストと混ざらないようにする

### テスト設計との対応

テストは、テスト設計（[docs/test-design](../../docs/test-design/README.md)）のルールの ID をタグで付ける。決まりは docs/test-design/README.md の「テストとの対応」。

```ts
test('「テーブルビュー」を押すと、テーブルビューに遷移し、並び替えと検索の条件を引き継ぐ', { tag: ['@TC-PG-CARD-HDR3'] }, async ({ ownerPage }) => { … })
test('研究者が前後のカードへ移りながら入力を続ける', { tag: ['@story', '@TC-PG-CARD-US2'] }, async ({ ownerPage }) => { … })
```

- ユーザーストーリー（ID の種別が `US`）のテストには `@story` も付ける。ストーリーのテストは、利用者の目的に沿った一連の操作で確かめる
- 仕様書を変えたら、同じパスのテスト設計を直し、`pnpm run check:test-design` を流す（runner の中で。上の「その他のコマンド」）。ルールにテストが無い・対象外の理由が無いものなどを知らせる
- 画面で確かめられないルールは、テスト設計に `対象外` と種類・理由を書く

### 既知の問題・実装との乖離

今の挙動を期待値にする。テスト名に「【既知の問題】」（`docs/ISSUES.md` の問題）または「【実装との乖離】」（仕様書の「実装との乖離」）と、あるべき挙動を書き、`knownIssue()` を付ける。

```ts
test('【既知の問題】項目名の見出しを押しても並び替わらない（あるべき: その項目で並び替わる）', {
  annotation: [knownIssue('docs/ISSUES.md', '項目名で並び替えられない')],
}, async () => { … })
```

- このテストには、テスト設計のルールのタグを付けない。そのルールはテスト設計で `対象外` `乖離` にする
- `knownIssue('docs/ISSUES.md', '<見出し>')` の見出しは、ISSUES.md の見出しと一字一句同じにする（`check:test-design` が確かめる）
- 仕様書の「実装との乖離」だけに書いてあるものは `knownIssue('pages/xxx.md', '<内容>')` とする

直すときは `docs/ISSUES.md` の「直すときの手順」に従い、テストの期待値を先に変えて失敗することを確かめる。直したら、テストにルールのタグを付け、テスト設計の `対象外` の行を消す。

## このテストで確かめられないこと

- Google でのログイン。ログイン画面の「Google でログイン」から Google へ移るところまでを確かめ、その先は通らない（ログイン状態は DB に直接作る）
- 本番の環境（リバースプロキシ・HTTPS・Basic 認証）

## 注意点

- テストは 4 つ並べて流す（`playwright.config.ts` の `workers: 4`。全体で 20 分ほど）。全体の時間は、1 分に 1 件ずつ取り込むインポートのテストでほぼ決まる。アプリのロックの失敗（`SQLITE_BUSY`）が出たら、app のログ（`compose-logs/compose.log`）で確かめる
- テストが `Target crashed`（ブラウザのタブが落ちる）でまとめて落ちるときは、Docker のメモリが足りていない。ほかのプロジェクトのコンテナが Docker Desktop のメモリを使っていると起きる（2026-11-17、19.5GB のうち 18GB ほどが使われていて、4 並列で 72 件落ちた）。止めるか、`--workers=1` で流す
- テストの前に `global-setup.ts` が、保存先に `uploads/imports`・`uploads/public/images`・`uploads/public/thumbs` を作る。製品はこのフォルダを作らないので、本番の保存先と同じ状態にしている（`docs/ISSUES.md`「まっさらな保存先ではインポートと縮小画像が失敗する」）
- インポートを待つテスト（`*.import.spec.ts`）は、毎分 0 秒に動く定期タスクを待つ。1 件ごとに最大 1 分ほどかかる。取り込みはシステム全体で古い順に 1 件ずつなので、ほかのテストが待たせたインポートがあると遅れる。テストが終わると、fixture の `newAccount` が、そのテストのユーザーのプロジェクトで取り込みを待っているインポートを消す
- カード入力ビュー・グリッドビューの画像の上には操作ボタンの層が重なっていて、`hover()` がその層に止められる。画像にマウスを乗せるときは `hover({ force: true })` を使う。縮小画像の読み込みで位置がずれるので、先に `scrollIntoViewIfNeeded()` する
- 画面を開いた直後のユーザーの設定の入力欄は、ログイン状態を読み込んだ後に値が入る。ユーザーIDと名前が入るのを待ってから入力する
