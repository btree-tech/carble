# API: 画像

仕様: [api/images.md](/docs/product-spec/api/images.md)

## テスト設計（外部仕様）

### POST /api/projects/{projectId}/cards/{cardId}/images（画像の追加）

処理

| ID | 条件 | 処理 | 層 |
|---|---|---|---|
| TC-AP-IMAGE-ADD1 | （常に） | 画像を保存し、カードに付ける | API E2E |
| TC-AP-IMAGE-ADD2 | （常に） | プロジェクトの最終更新日時を更新する | API E2E |

出力

| ID | 状態 | 条件 | 本文 | 層 |
|---|---|---|---|---|
| TC-AP-IMAGE-ADD3 | 200 | （常に） | 追加した画像 | API E2E |

エラー

| ID | 状態 | 条件 | 層 |
|---|---|---|---|
| TC-AP-IMAGE-ADD4 | 400 | image が無いか、画像のファイルでない | API E2E |
| TC-AP-IMAGE-ADD5 | 404 | cardId のカードがプロジェクトに無い | API E2E |
| TC-AP-IMAGE-ADD6 | 409 | プロジェクトに取り込み待ち・取り込み中のインポートがある | API E2E |

### DELETE /api/projects/{projectId}/cards/{cardId}/images/{imageId}（画像の削除）

処理

| ID | 条件 | 処理 | 層 |
|---|---|---|---|
| TC-AP-IMAGE-DEL1 | （常に） | 画像を削除する | API E2E |
| TC-AP-IMAGE-DEL2 | （常に） | 画像のファイルと縮小した画像のファイルを消す | API E2E |
| TC-AP-IMAGE-DEL3 | （常に） | プロジェクトの最終更新日時を更新する | API E2E |

出力

| ID | 状態 | 条件 | 本文 | 層 |
|---|---|---|---|---|
| TC-AP-IMAGE-DEL4 | 204 | （常に） | なし | API E2E |

エラー

| ID | 状態 | 条件 | 層 |
|---|---|---|---|
| TC-AP-IMAGE-DEL5 | 404 | cardId のカードがプロジェクトに無い | API E2E |
| TC-AP-IMAGE-DEL6 | 404 | imageId の画像が無い | API E2E |
| TC-AP-IMAGE-DEL7 | 409 | プロジェクトに取り込み待ち・取り込み中のインポートがある | API E2E |

### GET /uploads/images/{filename}（画像のファイル）

処理

| ID | 条件 | 処理 | 層 |
|---|---|---|---|
| TC-AP-IMAGE-FILE1 | （常に） | 画像のファイルを読む | API E2E |

出力

| ID | 状態 | 条件 | 本文 | 層 |
|---|---|---|---|---|
| TC-AP-IMAGE-FILE2 | 200 | （常に） | 画像のファイル | API E2E |

エラー

| ID | 状態 | 条件 | 層 |
|---|---|---|---|
| TC-AP-IMAGE-FILE3 | 404 | filename のファイルが無い | API E2E |

### GET /uploads/thumbs/{filename}（縮小した画像のファイル）

処理

| ID | 条件 | 処理 | 層 |
|---|---|---|---|
| TC-AP-IMAGE-THUM1 | 縮小した画像がまだ無い | 長辺 640px 以内に縮小した画像（WebP）を作る。元の画像より大きくはしない | API E2E |
| TC-AP-IMAGE-THUM2 | 縮小した画像がある | 作った縮小した画像を使う | API E2E |

出力

| ID | 状態 | 条件 | 本文 | 層 |
|---|---|---|---|---|
| TC-AP-IMAGE-THUM3 | 200 | （常に） | 縮小した画像のファイル（WebP） | API E2E |

エラー

| ID | 状態 | 条件 | 層 |
|---|---|---|---|
| TC-AP-IMAGE-THUM4 | 404 | 元の画像のファイルが無い | API E2E |
