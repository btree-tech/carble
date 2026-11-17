# API: その他

仕様: [api/system.md](/docs/product-spec/api/system.md)

## テスト設計（外部仕様）

### GET /api/auth/{all}（認証）

処理

| ID | 条件 | 処理 | 層 |
|---|---|---|---|
| TC-AP-SYS-AUTH1 | （常に） | 認証のライブラリが、ログイン・ログアウト・ユーザーの登録と削除を処理する（ログイン・ユーザー登録・設定（ユーザー）の仕様） | API E2E |

出力

| ID | 状態 | 条件 | 本文 | 層 |
|---|---|---|---|---|
| TC-AP-SYS-AUTH2 | （ライブラリが決める） | （常に） | （ライブラリが決める） | API E2E |

### GET /api/health（稼働の確認）

出力

| ID | 状態 | 条件 | 本文 | 層 |
|---|---|---|---|---|
| TC-AP-SYS-HLTH1 | 200 | （常に） | ok | API E2E |

### GET /api/print_layouts（印刷のレイアウトの一覧）

処理

| ID | 条件 | 処理 | 層 |
|---|---|---|---|
| TC-AP-SYS-LAYS1 | （常に） | カード印刷ビューのレイアウトの定義をすべて取得する | API E2E |

出力

| ID | 状態 | 条件 | 本文 | 層 |
|---|---|---|---|---|
| TC-AP-SYS-LAYS2 | 200 | （常に） | レイアウトの定義の配列 | API E2E |

### GET /api/print_layouts/{layoutId}（印刷のレイアウトの取得）

処理

| ID | 条件 | 処理 | 層 |
|---|---|---|---|
| TC-AP-SYS-LAY1 | （常に） | layoutId のレイアウトの定義を取得する | API E2E |

出力

| ID | 状態 | 条件 | 本文 | 層 |
|---|---|---|---|---|
| TC-AP-SYS-LAY2 | 200 | （常に） | レイアウトの定義 | API E2E |

エラー

| ID | 状態 | 条件 | 層 |
|---|---|---|---|
| TC-AP-SYS-LAY3 | 404 | layoutId のレイアウトが無い | API E2E |

- `対象外` `参照` TC-AP-SYS-AUTH1: 認証のライブラリの API で、使い方は画面の仕様が定める。[pages/login.md](/docs/test-design/pages/login.md)・[pages/user-register.md](/docs/test-design/pages/user-register.md)・[pages/user-settings.md](/docs/test-design/pages/user-settings.md) のテストで確かめる
- `対象外` `参照` TC-AP-SYS-AUTH2: 応答は認証のライブラリが決める。[pages/login.md](/docs/test-design/pages/login.md)・[pages/user-register.md](/docs/test-design/pages/user-register.md)・[pages/user-settings.md](/docs/test-design/pages/user-settings.md) のテストで確かめる
