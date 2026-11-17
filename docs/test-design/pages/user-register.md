# ユーザー登録

仕様: [pages/user-register.md](/docs/product-spec/pages/user-register.md)

## テスト設計（ユーザーストーリー）

| ID | ストーリー | 層 |
|---|---|---|
| TC-PG-REGISTER-US1 | 研究者が、初回ログイン時にユーザーIDを決めることで、他のユーザーからプロジェクトに招待してもらえるようにしたい | ブラウザ E2E |
| TC-PG-REGISTER-US2 | 研究者が、表示される名前を決めることで、作業した人として自分の名前が分かるようにしたい | ブラウザ E2E |

## テスト設計（外部仕様）

| ID | 区間（WHILE） | 操作（WHEN） | 異常（IF） | 結果 | 層 |
|---|---|---|---|---|---|
| TC-PG-REGISTER-GEN1 |  |  |  | 「ユーザーID」と「名前」の入力欄と、「保存」ボタンを表示する | ブラウザ E2E |
| TC-PG-REGISTER-GEN2 |  |  |  | ほかの画面へのリンク（プロジェクト一覧へ戻るリンクなど）は表示しない | ブラウザ E2E |
| TC-PG-REGISTER-GEN3 |  |  |  | 入力欄の初期値は、今のユーザーIDと名前とする | ブラウザ E2E |
| TC-PG-REGISTER-GEN4 |  |  |  | 初めてログインしたときは、ユーザーID は空、名前は Google アカウントの名前とする | ブラウザ E2E |
| TC-PG-REGISTER-GEN5 |  |  |  | ユーザーID の入力欄が空のときは、「carble」を薄く表示する（プレースホルダー） | ブラウザ E2E |
| TC-PG-REGISTER-GEN6 |  |  |  | ユーザーID の入力欄に「利用可能な文字: 半角英数およびハイフン（-）、アンダースコア（_）」と案内を表示する | ブラウザ E2E |
| TC-PG-REGISTER-GEN7 |  |  |  | ユーザーID は入力するたびに確かめ、問題があれば入力欄の下に表示する | ブラウザ E2E |
| TC-PG-REGISTER-GEN8 |  |  | 3 文字未満または 30 文字を超える場合 | 「3文字以上30文字以下で設定してください」と表示する | ブラウザ E2E |
| TC-PG-REGISTER-GEN9 |  |  | 半角英数・ハイフン・アンダースコア以外の文字を含む場合 | 「利用できない文字が含まれています」と表示する | ブラウザ E2E |
| TC-PG-REGISTER-GEN10 |  |  | 他のユーザーが使っているユーザーID の場合 | 「既に使われています」と表示する | ブラウザ E2E |
| TC-PG-REGISTER-GEN11 |  |  | 他のユーザーが使っているユーザーID の場合 | 英字の大文字と小文字は区別しない（「Carble」は「carble」と同じユーザーID とみなす） | ブラウザ E2E |
| TC-PG-REGISTER-GEN12 | 他のユーザーが使っているかを確かめている間は |  |  | 入力欄に読み込み中のアイコンを表示する | ブラウザ E2E |
| TC-PG-REGISTER-GEN13 |  |  | 名前が空の場合 | 「必須です」と表示する | ブラウザ E2E |
| TC-PG-REGISTER-GEN14 | 入力に問題がある間は |  |  | 「保存」ボタンを押せない | ブラウザ E2E |
| TC-PG-REGISTER-GEN15 |  | 「保存」を押すと |  | ユーザーIDと名前を保存し、プロジェクト一覧に遷移する | ブラウザ E2E |
| TC-PG-REGISTER-GEN16 |  | 「保存」を押すと |  | ユーザーID の英字の大文字は、小文字にして保存する | ブラウザ E2E |

- `対象外` `参照` TC-PG-REGISTER-GEN7: 子の文のルール（TC-PG-REGISTER-GEN8・TC-PG-REGISTER-GEN9・TC-PG-REGISTER-GEN10・TC-PG-REGISTER-GEN12）で確かめる
