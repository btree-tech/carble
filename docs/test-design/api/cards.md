# API: カード

仕様: [api/cards.md](/docs/product-spec/api/cards.md)

## テスト設計（外部仕様）

### GET /api/projects/{projectId}/cards（カードの一覧）

処理

| ID | 条件 | 処理 | 層 |
|---|---|---|---|
| TC-AP-CARD-LIST1 | （常に） | プロジェクトのカードを取得する | API E2E |
| TC-AP-CARD-LIST2 | q がある | 値に q を含むカードだけにする | API E2E |
| TC-AP-CARD-LIST3 | sort が無いか id | ID の順に並べる | API E2E |
| TC-AP-CARD-LIST4 | sort が order | 並び順の順に並べ、並び順が同じなら ID の順にする | API E2E |
| TC-AP-CARD-LIST5 | sort が項目の ID | その項目の値の順に並べ、値が同じなら ID の順にする | API E2E |
| TC-AP-CARD-LIST6 | direction が無いか asc | 昇順に並べる | API E2E |
| TC-AP-CARD-LIST7 | direction が desc | 降順に並べる | API E2E |

出力

| ID | 状態 | 条件 | 本文 | 層 |
|---|---|---|---|---|
| TC-AP-CARD-LIST8 | 200 | （常に） | カードの配列（items）と、プロジェクトのカードの総数（total。q で絞り込む前の数）。各カードに、値（contents）・画像（images。追加した順）・複製元のカード（original）・複製先のカード（duplicates。複製先のプロジェクトの名前つき）を付ける | API E2E |

エラー

| ID | 状態 | 条件 | 層 |
|---|---|---|---|
| TC-AP-CARD-LIST9 | 400 | sort・direction が入力の形に合わない | API E2E |
| TC-AP-CARD-LIST10 | 409 | プロジェクトに取り込み待ち・取り込み中のインポートがある | API E2E |

### POST /api/projects/{projectId}/cards（カードの追加）

処理

| ID | 条件 | 処理 | 層 |
|---|---|---|---|
| TC-AP-CARD-ADD1 | （常に） | カードの ID を、プロジェクトの中でいちばん大きい ID の次にする | API E2E |
| TC-AP-CARD-ADD2 | nextToId が無い | 並び順の末尾に追加する | API E2E |
| TC-AP-CARD-ADD3 | nextToId がある | そのカードのすぐ下に追加し、プロジェクトのカードの並び順を 1 から振り直す | API E2E |
| TC-AP-CARD-ADD4 | image がある | 画像を保存し、カードに付ける | API E2E |
| TC-AP-CARD-ADD5 | （常に） | プロジェクトの最終更新日時を更新する | API E2E |

出力

| ID | 状態 | 条件 | 本文 | 層 |
|---|---|---|---|---|
| TC-AP-CARD-ADD6 | 200 | nextToId が無い | 追加したカード。画像（images）を付ける | API E2E |
| TC-AP-CARD-ADD7 | 204 | nextToId がある | なし | API E2E |

エラー

| ID | 状態 | 条件 | 層 |
|---|---|---|---|
| TC-AP-CARD-ADD8 | 400 | 本文が入力の形に合わない | API E2E |
| TC-AP-CARD-ADD9 | 400 | nextToId のカードがプロジェクトに無い | API E2E |
| TC-AP-CARD-ADD10 | 400 | image が画像のファイルでない | API E2E |
| TC-AP-CARD-ADD11 | 409 | プロジェクトに取り込み待ち・取り込み中のインポートがある | API E2E |

- `対象外` `乖離` TC-AP-CARD-ADD5: docs/ISSUES.md「カードを追加しても最終更新日時が変わらない」。画像を付けずに追加すると更新しない（画像を付けた追加では更新する）。今の挙動は tests/e2e/specs/pages/project-list.spec.ts の【既知の問題】のテストで確かめる

### PUT /api/projects/{projectId}/cards（カードの並び替え）

処理

| ID | 条件 | 処理 | 層 |
|---|---|---|---|
| TC-AP-CARD-ORD1 | （常に） | 各カードの並び順を送った値にする | API E2E |
| TC-AP-CARD-ORD2 | （常に） | プロジェクトの最終更新日時を更新する | API E2E |

出力

| ID | 状態 | 条件 | 本文 | 層 |
|---|---|---|---|---|
| TC-AP-CARD-ORD3 | 204 | （常に） | なし | API E2E |

エラー

| ID | 状態 | 条件 | 層 |
|---|---|---|---|
| TC-AP-CARD-ORD4 | 400 | 本文が入力の形に合わない | API E2E |
| TC-AP-CARD-ORD5 | 400 | 送ったカードの数がプロジェクトのカードの数と違う | API E2E |
| TC-AP-CARD-ORD6 | 409 | プロジェクトに取り込み待ち・取り込み中のインポートがある | API E2E |

### DELETE /api/projects/{projectId}/cards（カードの一括削除）

処理

| ID | 条件 | 処理 | 層 |
|---|---|---|---|
| TC-AP-CARD-BDEL1 | （常に） | カードを、値・画像とともに削除する | API E2E |
| TC-AP-CARD-BDEL2 | （常に） | 画像のファイルと縮小した画像のファイルを消す | API E2E |
| TC-AP-CARD-BDEL3 | （常に） | プロジェクトの最終更新日時を更新する | API E2E |

出力

| ID | 状態 | 条件 | 本文 | 層 |
|---|---|---|---|---|
| TC-AP-CARD-BDEL4 | 204 | （常に） | なし | API E2E |

エラー

| ID | 状態 | 条件 | 層 |
|---|---|---|---|
| TC-AP-CARD-BDEL5 | 400 | 本文が入力の形に合わない | API E2E |
| TC-AP-CARD-BDEL6 | 400 | ids にプロジェクトに無いカードの ID がある | API E2E |
| TC-AP-CARD-BDEL7 | 409 | プロジェクトに取り込み待ち・取り込み中のインポートがある | API E2E |

### POST /api/projects/{projectId}/cards/duplicate（カードの複製）

処理

| ID | 条件 | 処理 | 層 |
|---|---|---|---|
| TC-AP-CARD-DUP1 | （常に） | カードを、値・画像（ファイルも）とともに複製する | API E2E |
| TC-AP-CARD-DUP2 | （常に） | 複製したカードに、複製元のカードを覚えさせる | API E2E |
| TC-AP-CARD-DUP3 | （常に） | 複製先に無い名前の項目を、複製先の項目の末尾に作る | API E2E |
| TC-AP-CARD-DUP4 | toProjectId がある | そのプロジェクトの末尾に、元の並び順で複製する | API E2E |
| TC-AP-CARD-DUP5 | toProjectId が無い | 「無題のプロジェクト」を作り、そこに複製する | API E2E |
| TC-AP-CARD-DUP6 | nextToId がある | そのカードのすぐ下に複製し、複製先のカードの並び順を 1 から振り直す | API E2E |
| TC-AP-CARD-DUP7 | （常に） | 複製先のプロジェクトの最終更新日時を更新する | API E2E |

出力

| ID | 状態 | 条件 | 本文 | 層 |
|---|---|---|---|---|
| TC-AP-CARD-DUP8 | 200 | （常に） | 複製したカードの配列 | API E2E |

エラー

| ID | 状態 | 条件 | 層 |
|---|---|---|---|
| TC-AP-CARD-DUP9 | 400 | 本文が入力の形に合わない | API E2E |
| TC-AP-CARD-DUP10 | 400 | toProjectId のプロジェクトが無い | API E2E |
| TC-AP-CARD-DUP11 | 409 | プロジェクトに取り込み待ち・取り込み中のインポートがある | API E2E |

### GET /api/projects/{projectId}/cards/{cardId}（カードの取得）

処理

| ID | 条件 | 処理 | 層 |
|---|---|---|---|
| TC-AP-CARD-GET1 | （常に） | カードを取得する | API E2E |

出力

| ID | 状態 | 条件 | 本文 | 層 |
|---|---|---|---|---|
| TC-AP-CARD-GET2 | 200 | （常に） | カード。値（contents）と画像（images。追加した順）を付ける | API E2E |

エラー

| ID | 状態 | 条件 | 層 |
|---|---|---|---|
| TC-AP-CARD-GET3 | 404 | cardId のカードがプロジェクトに無い | API E2E |
| TC-AP-CARD-GET4 | 409 | プロジェクトに取り込み待ち・取り込み中のインポートがある | API E2E |

### DELETE /api/projects/{projectId}/cards/{cardId}（カードの削除）

処理

| ID | 条件 | 処理 | 層 |
|---|---|---|---|
| TC-AP-CARD-DEL1 | （常に） | カードを、値・画像とともに削除する | API E2E |
| TC-AP-CARD-DEL2 | （常に） | 画像のファイルと縮小した画像のファイルを消す | API E2E |
| TC-AP-CARD-DEL3 | （常に） | プロジェクトの最終更新日時を更新する | API E2E |

出力

| ID | 状態 | 条件 | 本文 | 層 |
|---|---|---|---|---|
| TC-AP-CARD-DEL4 | 204 | （常に） | なし | API E2E |

エラー

| ID | 状態 | 条件 | 層 |
|---|---|---|---|
| TC-AP-CARD-DEL5 | 404 | cardId のカードがプロジェクトに無い | API E2E |
| TC-AP-CARD-DEL6 | 409 | プロジェクトに取り込み待ち・取り込み中のインポートがある | API E2E |

### PUT /api/projects/{projectId}/cards/{cardId}/fields/{fieldId}（値の保存）

処理

| ID | 条件 | 処理 | 層 |
|---|---|---|---|
| TC-AP-CARD-VAL1 | 値がまだ無い | 値を作る | API E2E |
| TC-AP-CARD-VAL2 | 値がある | 値を書き換える | API E2E |
| TC-AP-CARD-VAL3 | （常に） | プロジェクトの最終更新日時を更新する | API E2E |

出力

| ID | 状態 | 条件 | 本文 | 層 |
|---|---|---|---|---|
| TC-AP-CARD-VAL4 | 200 | （常に） | 保存した値 | API E2E |

エラー

| ID | 状態 | 条件 | 層 |
|---|---|---|---|
| TC-AP-CARD-VAL5 | 400 | 本文が入力の形に合わない | API E2E |
| TC-AP-CARD-VAL6 | 404 | cardId のカードがプロジェクトに無い | API E2E |
| TC-AP-CARD-VAL7 | 404 | fieldId の項目がプロジェクトに無い | API E2E |
| TC-AP-CARD-VAL8 | 409 | プロジェクトに取り込み待ち・取り込み中のインポートがある | API E2E |
