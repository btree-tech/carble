# API: メンバー

仕様: [api/members.md](/docs/product-spec/api/members.md)

## テスト設計（外部仕様）

### GET /api/projects/{projectId}/users（メンバーの一覧）

処理

| ID | 条件 | 処理 | 層 |
|---|---|---|---|
| TC-AP-MEMBER-LIST1 | （常に） | プロジェクトのメンバーを、プロジェクトに加わった順に取得する | API E2E |
| TC-AP-MEMBER-LIST2 | 自分がオーナー | 招待中のユーザーも含める | API E2E |

出力

| ID | 状態 | 条件 | 本文 | 層 |
|---|---|---|---|---|
| TC-AP-MEMBER-LIST3 | 200 | （常に） | メンバーの配列。各メンバーに、ユーザーの ID（id）・ユーザーID（username）・名前（name）・ロール（role）・招待の状態（status）を付ける | API E2E |

エラー

| ID | 状態 | 条件 | 層 |
|---|---|---|---|
| TC-AP-MEMBER-LIST4 | 409 | プロジェクトに取り込み待ち・取り込み中のインポートがある | API E2E |

### POST /api/projects/{projectId}/users（ユーザーの招待）

処理

| ID | 条件 | 処理 | 層 |
|---|---|---|---|
| TC-AP-MEMBER-INV1 | （常に） | username のユーザーを、プロジェクトに招待中のユーザーとして加える | API E2E |

出力

| ID | 状態 | 条件 | 本文 | 層 |
|---|---|---|---|---|
| TC-AP-MEMBER-INV2 | 204 | （常に） | なし | API E2E |

エラー

| ID | 状態 | 条件 | 層 |
|---|---|---|---|
| TC-AP-MEMBER-INV3 | 400 | 本文が入力の形に合わない | API E2E |
| TC-AP-MEMBER-INV4 | 400 | username のユーザーがいない | API E2E |
| TC-AP-MEMBER-INV5 | 409 | プロジェクトに取り込み待ち・取り込み中のインポートがある | API E2E |

### PUT /api/projects/{projectId}/users/{userId}（招待の承認）

処理

| ID | 条件 | 処理 | 層 |
|---|---|---|---|
| TC-AP-MEMBER-ACPT1 | （常に） | 招待を承認し、プロジェクトの編集者にする | API E2E |

出力

| ID | 状態 | 条件 | 本文 | 層 |
|---|---|---|---|---|
| TC-AP-MEMBER-ACPT2 | 204 | （常に） | なし | API E2E |

エラー

| ID | 状態 | 条件 | 層 |
|---|---|---|---|
| TC-AP-MEMBER-ACPT3 | 400 | 本文が入力の形に合わない | API E2E |
| TC-AP-MEMBER-ACPT4 | 409 | プロジェクトに取り込み待ち・取り込み中のインポートがある | API E2E |

### DELETE /api/projects/{projectId}/users/{userId}（メンバーを外す・招待の取り消し・招待の拒否）

処理

| ID | 条件 | 処理 | 層 |
|---|---|---|---|
| TC-AP-MEMBER-DEL1 | 自分がオーナーで、userId が編集者 | そのユーザーをプロジェクトから外す | API E2E |
| TC-AP-MEMBER-DEL2 | 自分がオーナーで、userId が招待中のユーザー | 招待を取り消す | API E2E |
| TC-AP-MEMBER-DEL3 | userId が自分で、自分が招待中 | 招待を拒否する | API E2E |

出力

| ID | 状態 | 条件 | 本文 | 層 |
|---|---|---|---|---|
| TC-AP-MEMBER-DEL4 | 204 | （常に） | なし | API E2E |

エラー

| ID | 状態 | 条件 | 層 |
|---|---|---|---|
| TC-AP-MEMBER-DEL5 | 409 | プロジェクトに取り込み待ち・取り込み中のインポートがある | API E2E |
