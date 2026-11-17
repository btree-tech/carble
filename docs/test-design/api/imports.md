# API: インポート

仕様: [api/imports.md](/docs/product-spec/api/imports.md)

## テスト設計（外部仕様）

### GET /api/projects/{projectId}/imports（インポートの一覧）

処理

| ID | 条件 | 処理 | 層 |
|---|---|---|---|
| TC-AP-IMPORT-LIST1 | （常に） | プロジェクトのインポートを取得する | API E2E |
| TC-AP-IMPORT-LIST2 | status がある | そのどれかの状態のインポートだけにする | API E2E |
| TC-AP-IMPORT-LIST3 | unnotified が true | 結果を知らせていないインポートだけにする | API E2E |
| TC-AP-IMPORT-LIST4 | （常に） | 登録の新しい順に並べ、page のページの pageCount 件を取る | API E2E |

出力

| ID | 状態 | 条件 | 本文 | 層 |
|---|---|---|---|---|
| TC-AP-IMPORT-LIST5 | 200 | （常に） | インポートの配列（items）、絞り込んだインポートの総数（total）、1 ページの件数（pageCount） | API E2E |

エラー

| ID | 状態 | 条件 | 層 |
|---|---|---|---|
| TC-AP-IMPORT-LIST6 | 400 | クエリが入力の形に合わない | API E2E |

### POST /api/projects/{projectId}/imports（インポートの登録）

処理

| ID | 条件 | 処理 | 層 |
|---|---|---|---|
| TC-AP-IMPORT-ADD1 | （常に） | ファイルを保存し、インポートを取り込み待ち（OPEN）として登録する（取り込みはインポート・エクスポートの仕様） | API E2E |
| TC-AP-IMPORT-ADD2 | update が true | 同じ ID のカードを上書きするインポートにする | API E2E |

出力

| ID | 状態 | 条件 | 本文 | 層 |
|---|---|---|---|---|
| TC-AP-IMPORT-ADD3 | 200 | （常に） | 登録したインポート | API E2E |

エラー

| ID | 状態 | 条件 | 層 |
|---|---|---|---|
| TC-AP-IMPORT-ADD4 | 422 | file が無いか、zip・CSV・エクセルのファイルでない | API E2E |

### PUT /api/projects/{projectId}/imports/{importId}（インポートの結果を知らせたことの記録）

処理

| ID | 条件 | 処理 | 層 |
|---|---|---|---|
| TC-AP-IMPORT-NTFY1 | （常に） | インポートに、結果を知らせた日時を記録する | API E2E |

出力

| ID | 状態 | 条件 | 本文 | 層 |
|---|---|---|---|---|
| TC-AP-IMPORT-NTFY2 | 200 | （常に） | 記録したインポート | API E2E |

エラー

| ID | 状態 | 条件 | 層 |
|---|---|---|---|
| TC-AP-IMPORT-NTFY3 | 404 | importId のインポートがプロジェクトに無い | API E2E |
| TC-AP-IMPORT-NTFY4 | 400 | 本文が入力の形に合わない | API E2E |
