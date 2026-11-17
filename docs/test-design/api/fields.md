# API: 項目

仕様: [api/fields.md](/docs/product-spec/api/fields.md)

## テスト設計（外部仕様）

### POST /api/projects/{projectId}/fields（項目の追加）

処理

| ID | 条件 | 処理 | 層 |
|---|---|---|---|
| TC-AP-FIELD-ADD1 | （常に） | 項目を項目の末尾に追加する | API E2E |
| TC-AP-FIELD-ADD2 | （常に） | プロジェクトの最終更新日時を更新する | API E2E |

出力

| ID | 状態 | 条件 | 本文 | 層 |
|---|---|---|---|---|
| TC-AP-FIELD-ADD3 | 200 | （常に） | 追加した項目 | API E2E |

エラー

| ID | 状態 | 条件 | 層 |
|---|---|---|---|
| TC-AP-FIELD-ADD4 | 400 | 本文が入力の形に合わない | API E2E |
| TC-AP-FIELD-ADD5 | 409 | プロジェクトに取り込み待ち・取り込み中のインポートがある | API E2E |

### PUT /api/projects/{projectId}/fields（項目の並び替え）

処理

| ID | 条件 | 処理 | 層 |
|---|---|---|---|
| TC-AP-FIELD-ORD1 | （常に） | 各項目の並び順を送った値にする | API E2E |
| TC-AP-FIELD-ORD2 | （常に） | プロジェクトの最終更新日時を更新する | API E2E |

出力

| ID | 状態 | 条件 | 本文 | 層 |
|---|---|---|---|---|
| TC-AP-FIELD-ORD3 | 204 | （常に） | なし | API E2E |

エラー

| ID | 状態 | 条件 | 層 |
|---|---|---|---|
| TC-AP-FIELD-ORD4 | 400 | 本文が入力の形に合わない | API E2E |
| TC-AP-FIELD-ORD5 | 400 | 送った項目の数がプロジェクトの項目の数と違う | API E2E |
| TC-AP-FIELD-ORD6 | 400 | 送った並び順が重なっている | API E2E |
| TC-AP-FIELD-ORD7 | 409 | プロジェクトに取り込み待ち・取り込み中のインポートがある | API E2E |

### PUT /api/projects/{projectId}/fields/{fieldId}（項目の変更）

処理

| ID | 条件 | 処理 | 層 |
|---|---|---|---|
| TC-AP-FIELD-UPD1 | name がある | 項目名を name にする | API E2E |
| TC-AP-FIELD-UPD2 | isVisible がある | 項目の表示・非表示を isVisible にする | API E2E |
| TC-AP-FIELD-UPD3 | （常に） | プロジェクトの最終更新日時を更新する | API E2E |

出力

| ID | 状態 | 条件 | 本文 | 層 |
|---|---|---|---|---|
| TC-AP-FIELD-UPD4 | 204 | （常に） | なし | API E2E |

エラー

| ID | 状態 | 条件 | 層 |
|---|---|---|---|
| TC-AP-FIELD-UPD5 | 400 | 本文が入力の形に合わない | API E2E |
| TC-AP-FIELD-UPD6 | 404 | fieldId の項目がプロジェクトに無い | API E2E |
| TC-AP-FIELD-UPD7 | 409 | プロジェクトに取り込み待ち・取り込み中のインポートがある | API E2E |

### DELETE /api/projects/{projectId}/fields/{fieldId}（項目の削除）

処理

| ID | 条件 | 処理 | 層 |
|---|---|---|---|
| TC-AP-FIELD-DEL1 | （常に） | 項目を、各カードのその項目の値とともに削除する | API E2E |
| TC-AP-FIELD-DEL2 | （常に） | プロジェクトの最終更新日時を更新する | API E2E |

出力

| ID | 状態 | 条件 | 本文 | 層 |
|---|---|---|---|---|
| TC-AP-FIELD-DEL3 | 204 | （常に） | なし | API E2E |

エラー

| ID | 状態 | 条件 | 層 |
|---|---|---|---|
| TC-AP-FIELD-DEL4 | 404 | fieldId の項目がプロジェクトに無い | API E2E |
| TC-AP-FIELD-DEL5 | 409 | プロジェクトに取り込み待ち・取り込み中のインポートがある | API E2E |
