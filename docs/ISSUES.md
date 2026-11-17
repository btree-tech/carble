# 既知の問題

仕様書（[docs/product-spec/](product-spec/README.md)）に書かない、実装の不具合や制約。仕様書の「実装との乖離」からリンクする。

セキュリティの指摘は [plans/security-review/report.md](plans/security-review/report.md)（2026-10-13）にまとめてあり、ここには重ねて書かない。

## 直すときの手順

1. E2E テスト（`tests/e2e/`）のうち、この問題を【既知の問題】として今の挙動で確かめているテストの期待値を、あるべき挙動に変える
2. テストが失敗することを確かめる
3. 製品のコードを直し、テストが通ることを確かめる
4. この節と、仕様書の「実装との乖離」から記述を消す

## 項目名で並び替えられない

- 画面: [テーブルビュー](product-spec/pages/table-view.md#並び替え)
- 内容: 項目名の見出しを押しても、その項目で並び替わらない。並び順の昇順で表示し、矢印も並び順の列に出る
- 原因: [composables/card.ts](../packages/app/composables/card.ts) の `useCardsSortId` が、URL の `sort`（文字列）を `Number.isNaN(sortId)` で判定している。文字列に対しては常に `false` なので、項目の ID が `'order'` になる
- 仕様書: [テーブルビュー](product-spec/pages/table-view.md#実装との乖離)

## 新しいプロジェクトに複製するとプロジェクトを開けない

- 画面: テーブルビュー・カード入力ビュー・グリッドビューの「別プロジェクトに複製 > 新しいプロジェクト」、選択したカードの「複製 > 新しいプロジェクト」
- 内容: 作ったプロジェクトにオーナーが設定されない。誰もメンバーでないので、遷移した先は、エラー画面ではなく空の画面になる（「複製しました」とだけ表示し、項目・カード・メニューを表示しない。API は 404 を返す）。プロジェクト一覧にも出ない。データは DB に残る
- 原因: [duplicate.post.ts](../packages/app/server/api/projects/[projectId]/cards/duplicate.post.ts) の `findOrCreateProject` が、プロジェクトを作るときに `usersToProjects` の行を作らない
- 仕様書: [カードの複製](product-spec/features/card-duplicate.md#実装との乖離)

## 招待済みのユーザーを招待すると「存在しないIDです」と表示する

- 画面: [プロジェクト設定 > ユーザー管理](product-spec/pages/project-settings.md#ユーザー管理)
- 内容: すでにメンバー・招待中のユーザー（自分を含む）のユーザーIDで招待すると、「存在しないIDです」と表示する
- 原因: [users/index.post.ts](../packages/app/server/api/projects/[projectId]/users/index.post.ts) が重複を確かめずに挿入し、主キーの重複でエラーになる。画面はどのエラーでも「存在しないIDです」と表示する
- 仕様書: [プロジェクト設定](product-spec/pages/project-settings.md#実装との乖離)

## ユーザーを削除してもオーナーのプロジェクトが残る

- 画面: [設定（ユーザー）](product-spec/pages/user-settings.md#ユーザーデータの削除)、[プロジェクト一覧](product-spec/pages/project-list.md)
- 内容: ユーザーを削除しても、そのユーザーがオーナーのプロジェクト（カード・画像を含む）は消えない。オーナーがいなくなるので、編集者がいなければ誰も開けない。編集者がいれば、その編集者のプロジェクト一覧は、オーナー名を表示しようとしてエラー画面（500）になり、ほかのプロジェクトも開けなくなる。オーナーだけの操作（インポート・ユーザー管理・プロジェクト削除）は誰もできない
- 原因: `usersToProjects` だけが `users` の削除に連動して消え（`onDelete: 'cascade'`）、`projects` は残る（[schema/index.ts](../packages/db/lib/schema/index.ts) の `usersToProjects.userId`）。プロジェクト一覧（[pages/index.vue](../packages/app/pages/index.vue)）はオーナーの行が必ずある前提で `row.users[0].user.name` を参照する
- 仕様書: [設定（ユーザー）](product-spec/pages/user-settings.md#実装との乖離)、[プロジェクト一覧](product-spec/pages/project-list.md#実装との乖離)

## 画像のファイルが無いとエクスポートが終わらない

- 画面: [プロジェクト設定 > 全般](product-spec/pages/project-settings.md#全般) の「エクスポート」
- 内容: DB に記録があるのに、画像のファイルがサーバーに無い画像が 1 つでもあると、ダウンロードが終わらない（zip を閉じない）。今は「[エクスポートが失敗する](#エクスポートが失敗する)」のため、その前にエクスポートが失敗し、この問題は表に出ない
- 原因: [export.get.ts](../packages/app/server/api/projects/[projectId]/export.get.ts) で、画像のファイルが無いとき `new Promise` の中で `return Promise.resolve()` しており、外側の Promise の `resolve()` を呼ばない。`await` が終わらず、`zip.end()` に進まない
- 仕様書: [インポート・エクスポート](product-spec/features/import-export.md#実装との乖離)

## インポート中にプロジェクトの画面を直接開くとエラー画面になる

- 画面: `/projects/:id/` 以下（グリッドビュー・カード入力ビュー・印刷ビュー・プロジェクト設定など。テーブルビュー `/projects/:id` を除く）
- 内容: インポートを待っている間・取り込んでいる間に、画面を再読み込みしたり URL を直接開いたりすると、「インポート中です」のダイアログではなく、エラー画面（409）を表示する。画面内の遷移で開いた場合はダイアログを表示する
- 原因: サーバーのミドルウェア（[4.checkIsImporting.ts](../packages/app/server/middleware/4.checkIsImporting.ts)）が、API だけでなく画面のパスも `/projects/<数字>/` で判定し、インポート中なら 409 を返す。テーブルビューのパスは末尾に `/` が無いので当たらない
- 仕様書: [インポート・エクスポート](product-spec/features/import-export.md#実装との乖離)、[プロジェクト設定](product-spec/pages/project-settings.md#実装との乖離)

## 画像ファイルの列で空白が続くとシステムエラーになり、途中まで取り込まれる

- 画面: [インポート](product-spec/features/import-export.md#インポート)（zip）
- 内容: 「画像ファイル」の列で、空白・改行が 2 つ以上続く、先頭・末尾にある、または Windows の改行（CR LF）で区切ると、システムエラーになる。エラーになっても、それまでに取り込んだ項目・カード・値と、画像の記録の置き換えは元に戻らない。置き換えた後の画像の記録が指すファイルは作られていないことがある
- 原因: [tasks/import.ts](../packages/app/server/tasks/import.ts) が `split(/\s/)` で空白 1 文字ごとに区切るため、空のファイル名ができる。空のファイル名は展開したフォルダそのものを指すので、存在の確認を通り、`copyFile` で失敗する。項目・カード・値・画像の記録の書き込みをトランザクションにまとめていないため、失敗しても戻らない
- 仕様書: [インポート・エクスポート](product-spec/features/import-export.md#実装との乖離)

## 初回のユーザー登録でユーザーIDを入れずに保存できる

- 画面: [ユーザー登録](product-spec/pages/user-register.md)
- 内容: 初めてログインしたとき、ユーザーIDの入力欄に一度も触れずに「保存」を押せる。ユーザーIDの無いまま保存し、プロジェクト一覧に遷移しようとして、この画面に戻される。メッセージは表示しない
- 原因: [FormUserEdit.vue](../packages/app/components/FormUserEdit.vue) の「保存」は、入力の検証で誤りが見つかったときだけ押せなくなる。触れていない欄は検証せず、スキーマ（drizzle-zod）も空（null）を通す
- 仕様書: [ユーザー登録](product-spec/pages/user-register.md#実装との乖離)

## 自分のユーザーIDの大文字・小文字だけを変えると「既に使われています」と表示する

- 画面: [設定（ユーザー）](product-spec/pages/user-settings.md)
- 内容: 今のユーザーIDの大文字・小文字だけを変えると（「carble」を「Carble」にするなど）、「既に使われています」と表示し、保存できない
- 原因: [FormUserEdit.vue](../packages/app/components/FormUserEdit.vue) は、入力が今のユーザーIDと完全に一致するときだけ自分のIDとみなす。Better Auth の使用中の確認は小文字にして照合するため、自分のIDが使用中と判定される
- 仕様書: [設定（ユーザー）](product-spec/pages/user-settings.md#実装との乖離)

## 検索の文字に記号を含むと入れたとおりに検索されない

- 画面: [テーブルビュー](product-spec/pages/table-view.md#検索)
- 内容: 「&」から後ろが落ち、「+」は空白として検索する。「%」「_」は任意の文字に当たる。「#」を含むと URL が壊れ（例: `/projects/?q=R?q=R#D&…`）、API が 400 を返して一覧が空になる
- 原因: [TableViewFilter.vue](../packages/app/components/TableView/TableViewFilter.vue) と [TableViewFieldName.vue](../packages/app/components/TableView/TableViewFieldName.vue) が、URL の `q` を URL エンコードせずに組み立てる。[cards/index.get.ts](../packages/app/server/api/projects/[projectId]/cards/index.get.ts) が LIKE の特殊文字をエスケープしない
- 仕様書: [テーブルビュー](product-spec/pages/table-view.md#実装との乖離)

## カード入力ビューでカードを削除すると次のカードに遷移しない

- 画面: [カード入力ビュー](product-spec/pages/card-view.md) の「削除」
- 内容: 確認で取り消しても、カードは削除しないが次のカード（無ければテーブルビュー）に遷移する。確認して削除すると、次のカードがあっても、テーブルビューに遷移する
- 原因: [CardViewMenu.vue](../packages/app/components/CardView/CardViewMenu.vue) が、`useCardRemove`（[composables/card.ts](../packages/app/composables/card.ts)）で取り消したかどうかを確かめずに遷移する。また、削除して一覧を取り直すと、表示中のカードが一覧の最後のカードに置き換わり（[検索中にカードを追加すると別のカードを表示する](#検索中にカードを追加すると別のカードを表示する) と同じ `.at(-1)`）、その「次」が無いのでテーブルビューに遷移する
- 仕様書: [カード入力ビュー](product-spec/pages/card-view.md#実装との乖離)

## 検索中にカードを追加すると別のカードを表示する

- 画面: [カード入力ビュー](product-spec/pages/card-view.md)・[テーブルビュー](product-spec/pages/table-view.md) の「追加」（検索の条件を引き継いでいるとき）
- 内容: 追加した空のカードは検索に当たらないため、遷移した先に検索結果の最後のカードを表示する。そのまま入力した値や追加した画像は、表示している別のカードに保存する（データを壊す）
- 原因: [composables/card.ts](../packages/app/composables/card.ts) の `useCard` が、一覧に無いカードの位置（-1）をそのまま `.at()` に渡し、一覧の最後のカードを返す
- 仕様書: [カード入力ビュー](product-spec/pages/card-view.md#実装との乖離)

## 一覧に無いカードの QR コードをスキャンすると別のカードに画像を追加する

- 画面: [スキャン](product-spec/features/scan.md)
- 内容: 開いているプロジェクトの一覧（検索しているときは検索結果）に無いカードの QR コードを読み取ると、一覧の最後のカードに画像を追加する。そのうえで読み取ったカードに遷移し、「ID: （ID）のカードに画像を追加しました」と表示する。別のプロジェクトのカードでも同じで、開いている一覧に同じ ID のカードがあれば、そのカードに追加する（カードの ID はプロジェクトごとに 1 から振るため）。検索中に読み取ると、遷移した後に読み取ったカードにも同じ画像を追加し、画像が 2 枚になることがある（毎回ではない）
- 原因: [ScanButton.vue](../packages/app/components/ScanButton.vue) が `useCardImageAdd` で画像を追加する。`useCardImageAdd` は開いている一覧からカードを探し、見つからないと `.at(-1)` で最後のカードを使う（[composables/card.ts](../packages/app/composables/card.ts)）。カードはプロジェクトを区別せず ID だけで探す
- 仕様書: [スキャン](product-spec/features/scan.md#実装との乖離)

## カード印刷ビューで非表示の内容を固定領域に選ぶと表示しない

- 画面: [カード印刷ビュー](product-spec/pages/print-view.md)
- 内容: 任意項目で非表示にしている内容を固定領域で選ぶと、固定領域に何も表示しない。固定領域では表示／非表示を切り替えられない。固定領域の多いレイアウトに変えて、非表示の内容が固定領域に移ったときも同じ
- 原因: [PrintViewSettingAreaReserved.vue](../packages/app/components/PrintView/PrintViewSettingAreaReserved.vue)・[PrintViewSettings.vue](../packages/app/components/PrintView/PrintViewSettings.vue) が固定領域に移すときに `isVisible` を変えず、[PrintViewCardArea.vue](../packages/app/components/PrintView/PrintViewCardArea.vue) が `isVisible` の内容だけを描く
- 仕様書: [カード印刷ビュー](product-spec/pages/print-view.md#実装との乖離)

## カード印刷ビューを開いた後に追加した項目を印刷できない

- 画面: [カード印刷ビュー](product-spec/pages/print-view.md)
- 内容: 同じプロジェクトのカード印刷ビューを最初に開いた後に追加した項目は、ブラウザを再読み込みするまで印刷できない。任意項目には表示で一覧されるが印刷に載らず、表示／非表示も切り替えられない。固定領域で選ぶと、その固定領域は空になる
- 原因: 印刷の設定（[composables/printView.ts](../packages/app/composables/printView.ts) の `useState`）を最初に開いたときだけ作り、後から追加した項目を設定に加えない
- 仕様書: [カード印刷ビュー](product-spec/pages/print-view.md#実装との乖離)

## エクスポートが失敗する

- 画面: [プロジェクト設定 > 全般](product-spec/pages/project-settings.md#全般) の「エクスポート」
- 内容: 「エクスポート」を押すと、ファイル名（`プロジェクト名-年月日時分秒.zip`）のダウンロードは始まるが、サーバーが 500 を返して失敗する。Node 24 でだけ起き、E2E の環境（`node:lts-slim` = Node 24）では、カードが 1 枚でも 100 枚でも失敗した。本番ではエクスポートできている（2026-10-28 ユーザー確認）。本番のイメージは Node 22 以前の `node:lts-slim` で作ったと見られ、作り直して Node 24 になると本番でも起きる見込み
  - 同じ転送を Node 20・22・24 で試すと、20・22 は転送でき、24 だけ失敗した
- 原因: [export.get.ts](../packages/app/server/api/projects/[projectId]/export.get.ts) が、SheetJS の `XLSX.write(…, { type: 'buffer' })` の `Buffer` をそのまま fflate の `AsyncZipDeflate` に渡す。`AsyncZipDeflate` は Worker に、渡されたデータの元の `ArrayBuffer` を転送する。この `Buffer` の `ArrayBuffer` を、Node 24 は転送できない（`DataCloneError: Cannot transfer object of unsupported type`）。画像の側は [CESCHI-153](https://kinako.atlassian.net/browse/CESCHI-153) で `Uint8Array` に詰め替えて直してあるが、エクセルの側は直っていない
- 直し方（案）: 画像の側と同じく、`XLSX.write` の結果を `Uint8Array.from(…)` で詰め替えてから `push` する（1 行の変更）。直したら、E2E テストの「【既知の問題】「エクスポート」を押しても…」の期待値を、ダウンロードできる側に変える
- 仕様書: [インポート・エクスポート](product-spec/features/import-export.md#実装との乖離)

## まっさらな保存先ではインポートと縮小画像が失敗する

- 画面: [インポート](product-spec/features/import-export.md#インポート)、画像を表示する画面（カード入力ビュー・グリッドビュー）
- 内容: 保存先（`storage/uploads/`）に `imports/` と `public/thumbs/` のフォルダが無いと、次のようになる。本番の保存先にはフォルダがあるので起きない。新しく立てた環境（E2E の環境を含む）で起きる
  - インポートのアップロードがファイルを書けず、画面は「インポート」が処理中のまま進まない。サーバーは DB の書き込みの途中で止まり、以後すべての書き込みがロックされて失敗する。プロジェクト一覧から新規にインポートした場合、ファイル名のプロジェクトだけが項目なしで残る
  - 縮小画像を書けず、画像が 500 で表示されない
- 原因: 原画像（`public/images/`）は Nitro のストレージで保存するのでフォルダごと作られるが、[imports/index.post.ts](../packages/app/server/api/projects/[projectId]/imports/index.post.ts)（ファイルの書き込み）と [thumbs/[filename].get.ts](../packages/app/server/routes/uploads/thumbs/[filename].get.ts)（sharp の `toFile`）はフォルダを作らない。インポートは、トランザクションの中でファイルの書き込みの終わりを待つため、書き込みに失敗するとトランザクションが終わらない
- E2E: テストの前に `tests/e2e/global-setup.ts` がフォルダを作り、本番と同じ状態にしている

## カードを追加しても最終更新日時が変わらない

- 画面: [プロジェクト一覧](product-spec/pages/project-list.md) の「最終更新日時」と並び順
- 内容: テーブルビュー・カード入力ビューの「追加」、テーブルビューの「直下に追加」でカードを追加しても、プロジェクトの最終更新日時が変わらない（一覧の並び順も変わらない）。スキャンで画像を添えて追加した場合は変わる
- 原因: [cards/index.post.ts](../packages/app/server/api/projects/[projectId]/cards/index.post.ts) が、画像を添えた追加のときだけ `touchProjectUpdatedAt` を呼ぶ
- 仕様書: [プロジェクト一覧](product-spec/pages/project-list.md#実装との乖離)

## 並び順が飛んでいると「直下に追加」「直下に複製」がすぐ下に入らない

- 画面: [テーブルビュー](product-spec/pages/table-view.md) の「直下に追加」、テーブルビュー・カード入力ビューの「直下に複製」（[カードの複製](product-spec/features/card-duplicate.md)）
- 内容: カードを削除して並び順の数字が飛んでいる（例: 3, 4）と、「直下に追加」「直下に複製」をしたカードがすぐ下に入らず、並び順がほかのカードと重なる（例: 並び順 3 のカードの直下に追加すると [1, 3, 3]）
- 原因: [cards/index.post.ts](../packages/app/server/api/projects/[projectId]/cards/index.post.ts)・[duplicate.post.ts](../packages/app/server/api/projects/[projectId]/cards/duplicate.post.ts) の並び順の振り直しの UPDATE で、行ごとに順位（`row_number`）を計算し直すため、途中まで書き換えた並び順で順位が決まる（推測）
- 仕様書: [テーブルビュー](product-spec/pages/table-view.md#実装との乖離)、[カードの複製](product-spec/features/card-duplicate.md#実装との乖離)

## BOM の無い UTF-8 の CSV は文字化けする

- 画面: [インポート](product-spec/features/import-export.md#インポート)（csv）
- 内容: BOM（先頭の目印）の無い UTF-8 の CSV をインポートすると、日本語が文字化けする。見出しが文字化けするので、既存の項目に当たらず、文字化けした名前の項目が増える。Excel の「CSV UTF-8」で保存したファイル（BOM 付き）は正しく取り込める
- 原因: [tasks/import.ts](../packages/app/server/tasks/import.ts) が `XLSX.readFile` に文字コードを指定せずに読む。SheetJS は BOM が無いと UTF-8 と判定しない
- 仕様書: [インポート・エクスポート](product-spec/features/import-export.md#実装との乖離)

## 同時に保存すると失敗し、DB がロックされたままになることがある

- 画面: すべて（E2E では、スキャン・画像の追加・プロジェクトの作成などで起きた）
- 内容: 次の 2 つ。どちらも API は 500 を返すが、画面にはメッセージを出さない（スキャンなら「スキャン完了」が出ないだけ）
  - 保存の処理（トランザクション）が重なると、後の方が `SQLITE_BUSY: database is locked` で失敗する。画像の追加・インポートのアップロードなどは、ファイルの保存を待つ間もトランザクションを開いたままにするので、その間に別の保存が来ると重なる
  - 別のプロセス（CLI など）が DB に書いている最中にアプリが読むと、その読み込みが `SQLITE_BUSY` で失敗し、以後アプリを起動し直すまで、書き込みがすべて失敗し続ける（`cannot commit transaction - SQL statements in progress` も出る）
  - 本番で起きているかは確かめていない。利用者が同時に保存するほど、CLI などで DB に書くほど起きやすい
- 原因: アプリの SQLite の接続（[packages/db/lib/index.ts](../packages/db/lib/index.ts) の `connect`）は、ロックを取れないと待たずに失敗する（`busy_timeout` が無い）。さらに libsql は、`SQLITE_BUSY` で失敗した文を片付けず、その接続が読み込みのロックを持ち続ける（アプリのコンテナで、別のプロセスが書き込み中に読む手順で再現した）
- E2E: runner が別のプロセスとして DB に書き、テストを並列で流すので、毎回のように起きる（直さずに 4 並列で流すと 247 件中 214 件が落ちた）。E2E のアプリだけ、環境変数 `CARBLE_E2E=1` で、手を入れた接続（[packages/db/lib/e2e.ts](../packages/db/lib/e2e.ts)。トランザクションを 1 つずつ流す・接続ごとに `busy_timeout` 1 秒・失敗したら接続を張り直してやり直す）に切り替えている。本番に入れるなら、このファイルの中身を `connect` に移す

## 別のプロジェクトのカード入力ビューから移ると、カードのメニューが移る前のカードのままになる

- 画面: [カード入力ビュー](product-spec/pages/card-view.md#カードのメニュー)の「複製元カードを表示」
- 内容: 別のプロジェクトにある複製のカード入力ビューから「複製元カードを表示」で複製元のカードに移ると、値は複製元のカードを表示するが、カードのメニュー「…」は移る前の複製のカードのままになる。複製元のカードに複製先があっても「複製先カードを表示」を選べず、複製元が無いのに「複製元カードを表示」を選べる。画面を読み込み直すと正しいメニューになる（2026-11-17、E2E で確かめた）
- 原因: 未調査。同じプロジェクトの中で移る場合に起きるかも確かめていない
- 仕様書: [カードの複製](product-spec/features/card-duplicate.md#実装との乖離)
- E2E: `tests/e2e/specs/features/card-duplicate.spec.ts` の【既知の問題】のテストで今の挙動を確かめる
