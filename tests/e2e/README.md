# 画面の E2E テスト（tests/e2e）

`docs/product-spec` の外部仕様のうち、画面に現れるもの（表示・操作・遷移）を、本番と同じイメージで動かしたアプリで確かめる Playwright のテスト。
導入の経緯と決めたことは [docs/plans/e2e-test/plan.md](../../docs/plans/e2e-test/plan.md) にある。

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
docker compose -p carble-e2e -f docker-compose.e2e.yml --profile runner run --rm --no-deps runner pnpm run coverage:spec
```

## 構成

| 場所 | 内容 |
|---|---|
| `specs/pages/*.spec.ts`、`specs/features/*.spec.ts` | テスト。仕様書（`docs/product-spec/pages`、`features`）1 本につき 1 本 |
| `*.mobile.spec.ts` | スマホ幅（Pixel 7）で流すテスト |
| `*.import.spec.ts` | インポートを待つテスト。毎分の定期タスクを待つので、別のプロジェクトにして順に流す |
| `pages/` | ページオブジェクト。ロケータと操作はここに置く |
| `support/db.ts` | ログインの仕込み（DB にユーザーとセッションを作り、Better Auth と同じ方式で署名した Cookie を返す） |
| `support/api.ts` | 製品の API を呼ぶ（前提データの作成） |
| `support/navigation.ts` | 画面を開き、ハイドレーションを待つ |
| `support/spec.ts` | 仕様書の項目との対応（`spec()`）、既知の問題の注記（`knownIssue()`） |
| `fixtures/index.ts` | テスト専用のユーザー・ログイン済みの画面・オーナーとプロジェクト |
| `files/` | インポートなどで使うファイル |
| `spec-out-of-scope.mjs`、`out-of-scope/*.mjs` | 画面のテストで確かめない仕様書の項目と、その理由（仕様書のまとまりごとに `out-of-scope/` に書く） |
| `scripts/check-spec-coverage.mjs` | 仕様書の項目とテストの対応を確かめる |

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

### 仕様書との対応

テストには、確かめる仕様書の項目を `spec()` で付ける。

```ts
test('項目名の見出しを押すと…', spec('pages/table-view.md',
  '並び替え > **WHEN** 項目名の見出しを押す',
), async ({ ownerPage }) => { … })
```

- 「節の見出し > 項目 > 入れ子の項目」の形で、各段は文言の書き出しでよい（兄弟の項目と区別できる長さ）
- 表の行は、セルを「 | 」でつないだ文言の書き出しで指す
- 別の仕様書の項目も同じテストで確かめるときは、`features/roles.md > …` の形で書く
- 仕様書を変えたら `pnpm run coverage:spec` を流す。未対応の項目は、そのまま `spec()` に貼れる形で出る
- 画面で確かめられない項目は、`out-of-scope/*.mjs` に区分と理由を書く。画面から見える部分は対象外にしない

### 既知の問題・実装との乖離

今の挙動を期待値にする。テスト名に「【既知の問題】」（`docs/ISSUES.md` の問題）または「【実装との乖離】」（仕様書の「実装との乖離」）と、あるべき挙動を書き、`knownIssue()` を付ける。

```ts
test('【既知の問題】項目名の見出しを押しても並び替わらない（あるべき: その項目で並び替わる）', withIssue(
  spec('pages/table-view.md', '並び替え > …'),
  knownIssue('docs/ISSUES.md', '項目名で並び替えられない'),
), async () => { … })
```

- `knownIssue('docs/ISSUES.md', '<見出し>')` の見出しは、ISSUES.md の見出しと一字一句同じにする（`coverage:spec` が確かめる）
- 仕様書の「実装との乖離」だけに書いてあるものは `knownIssue('pages/xxx.md', '<内容>')` とする

直すときは `docs/ISSUES.md` の「直すときの手順」に従い、テストの期待値を先に変えて失敗することを確かめる。

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
