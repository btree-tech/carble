# API: プロジェクト

仕様: [api/projects.md](/docs/product-spec/api/projects.md)

## テスト設計（外部仕様）

### GET /api/projects（プロジェクトの一覧）

処理

| ID | 条件 | 処理 | 層 |
|---|---|---|---|
| TC-AP-PROJ-LIST1 | status が無い | 自分がメンバー（招待中を除く）のプロジェクトを取得する | API E2E |
| TC-AP-PROJ-LIST2 | status が invited | 自分を招待しているプロジェクトを取得する | API E2E |
| TC-AP-PROJ-LIST3 | （常に） | 最終更新日時の新しい順に並べる | API E2E |

出力

| ID | 状態 | 条件 | 本文 | 層 |
|---|---|---|---|---|
| TC-AP-PROJ-LIST4 | 200 | （常に） | プロジェクトの配列。各プロジェクトに、オーナーの名前（users）と、取り込み待ち・取り込み中のインポート（imports。あれば 1 件）を付ける | API E2E |

エラー

| ID | 状態 | 条件 | 層 |
|---|---|---|---|
| TC-AP-PROJ-LIST5 | 400 | status が invited 以外 | API E2E |

### POST /api/projects（プロジェクトの作成）

処理

| ID | 条件 | 処理 | 層 |
|---|---|---|---|
| TC-AP-PROJ-ADD1 | （常に） | プロジェクトを作り、自分をオーナーにする | API E2E |
| TC-AP-PROJ-ADD2 | name がある | 名前を name にする | API E2E |
| TC-AP-PROJ-ADD3 | name が無い | 名前を「無題のプロジェクト」にする | API E2E |
| TC-AP-PROJ-ADD4 | fields が true | 項目「みだし」「メモ」をこの順に作る | API E2E |
| TC-AP-PROJ-ADD5 | fields が無い | 項目を作らない | API E2E |

出力

| ID | 状態 | 条件 | 本文 | 層 |
|---|---|---|---|---|
| TC-AP-PROJ-ADD6 | 200 | （常に） | 作ったプロジェクト | API E2E |

エラー

| ID | 状態 | 条件 | 層 |
|---|---|---|---|
| TC-AP-PROJ-ADD7 | 400 | 本文が入力の形に合わない | API E2E |

### GET /api/projects/{projectId}（プロジェクトの取得）

処理

| ID | 条件 | 処理 | 層 |
|---|---|---|---|
| TC-AP-PROJ-GET1 | （常に） | プロジェクトを取得する | API E2E |

出力

| ID | 状態 | 条件 | 本文 | 層 |
|---|---|---|---|---|
| TC-AP-PROJ-GET2 | 200 | （常に） | プロジェクト。項目（fields。並び順）・カードの ID の一覧（cards）・自分のロール（users）を付ける | API E2E |

### PUT /api/projects/{projectId}（プロジェクトの名前の変更）

処理

| ID | 条件 | 処理 | 層 |
|---|---|---|---|
| TC-AP-PROJ-NAME1 | （常に） | プロジェクトの名前を name にする | API E2E |
| TC-AP-PROJ-NAME2 | （常に） | プロジェクトの最終更新日時を更新する | API E2E |

出力

| ID | 状態 | 条件 | 本文 | 層 |
|---|---|---|---|---|
| TC-AP-PROJ-NAME3 | 200 | （常に） | 変えたプロジェクト | API E2E |

エラー

| ID | 状態 | 条件 | 層 |
|---|---|---|---|
| TC-AP-PROJ-NAME4 | 400 | 本文が入力の形に合わない | API E2E |

### DELETE /api/projects/{projectId}（プロジェクトの削除）

処理

| ID | 条件 | 処理 | 層 |
|---|---|---|---|
| TC-AP-PROJ-DEL1 | （常に） | プロジェクトを、カード・項目・値・画像とともに削除する | API E2E |
| TC-AP-PROJ-DEL2 | （常に） | 画像のファイルと縮小した画像のファイルを消す | API E2E |

出力

| ID | 状態 | 条件 | 本文 | 層 |
|---|---|---|---|---|
| TC-AP-PROJ-DEL3 | 204 | （常に） | なし | API E2E |

### GET /api/projects/{projectId}/export（エクスポート）

処理

| ID | 条件 | 処理 | 層 |
|---|---|---|---|
| TC-AP-PROJ-EXP1 | （常に） | 項目とカードをエクセルのファイルにし、画像のファイルとともに zip にする（中身はインポート・エクスポートの仕様） | API E2E |

出力

| ID | 状態 | 条件 | 本文 | 層 |
|---|---|---|---|---|
| TC-AP-PROJ-EXP2 | 200 | （常に） | zip のファイル | API E2E |

エラー

| ID | 状態 | 条件 | 層 |
|---|---|---|---|
| TC-AP-PROJ-EXP3 | 409 | プロジェクトに取り込み待ち・取り込み中のインポートがある | API E2E |

- `対象外` `乖離` TC-AP-PROJ-EXP1: docs/ISSUES.md「エクスポートが失敗する」。サーバーがエラー（500）を返す。今の挙動は tests/e2e/specs/features/import-export.spec.ts の【既知の問題】のテストで確かめる
- `対象外` `乖離` TC-AP-PROJ-EXP2: docs/ISSUES.md「エクスポートが失敗する」。サーバーがエラー（500）を返す。今の挙動は tests/e2e/specs/features/import-export.spec.ts の【既知の問題】のテストで確かめる
