# インポート・エクスポート

仕様: [features/import-export.md](/docs/product-spec/features/import-export.md)

## テスト設計（ユーザーストーリー）

| ID | ストーリー | 層 |
|---|---|---|
| TC-FT-IMPEXP-US1 | 研究者が、表計算ソフトで作ったデータや画像をまとめて取り込むことで、既存の資料のデータを一度に Carble に移したい 研究者が、エクスポートしたファイルをそのまま取り込めることで、表計算ソフトで編集してから戻したい | ブラウザ E2E |
| TC-FT-IMPEXP-US2 | 研究者が、表計算ソフトで作ったデータや画像をまとめて取り込むことで、既存の資料のデータを一度に Carble に移したい 研究者が、大きなファイルでもタイムアウトせずに取り込みたい | ブラウザ E2E |
| TC-FT-IMPEXP-US3 | 研究者が、表計算ソフトで作ったデータや画像をまとめて取り込むことで、既存の資料のデータを一度に Carble に移したい 研究者が、インポートの完了を自分で再読み込みせずに知りたい | ブラウザ E2E |
| TC-FT-IMPEXP-US4 | オーナーが、上書きを明示的に選ぶことで、意図せずカードの内容を失わないようにしたい | ブラウザ E2E |
| TC-FT-IMPEXP-US5 | 研究者が、プロジェクトのデータと画像をまとめて書き出すことで、バックアップや他のツールでの利用に使いたい | ブラウザ E2E |
| TC-FT-IMPEXP-US6 | 研究者が、インポートやエクスポートで、資料の順番（並び順）を保ちたい | ブラウザ E2E |

- `対象外` `乖離` TC-FT-IMPEXP-US5: エクスポートは Node 24 で失敗する（docs/ISSUES.md「エクスポートが失敗する」）。今の挙動は tests/e2e/specs/features/import-export.spec.ts の【既知の問題】のテストで確かめる

## テスト設計（外部仕様）

### エクスポート

| ID | 異常（IF） | 結果 | 層 |
|---|---|---|---|
| TC-FT-IMPEXP-EXP1 |  | プロジェクトのデータを zip ファイルでダウンロードする | ブラウザ E2E |
| TC-FT-IMPEXP-EXP2 |  | ファイル名は「（プロジェクト名）-（年月日時分秒）.zip」とする（例: 調査票-20261027153000.zip）。日時は、エクスポートを押したときの利用者の端末の日時とする | ブラウザ E2E |
| TC-FT-IMPEXP-EXP3 |  | zip には、エクセルのファイル 1 つと、カードの画像のファイルを入れる | ブラウザ E2E |
| TC-FT-IMPEXP-EXP4 |  | エクセルのファイル名は「（プロジェクト名）.xlsx」とする | ブラウザ E2E |
| TC-FT-IMPEXP-EXP5 |  | プロジェクト名にファイル名に使えない文字（\ / : * ? " < > \|）がある場合、_ に置き換える | ブラウザ E2E |
| TC-FT-IMPEXP-EXP6 |  | エクセルの 1 行目は見出しとし、「ID」、すべての項目（項目の並び順。非表示の項目も含む）、「画像ファイル」の列とする | ブラウザ E2E |
| TC-FT-IMPEXP-EXP7 |  | 2 行目以降に、カードを並び順の順に 1 行ずつ書く | ブラウザ E2E |
| TC-FT-IMPEXP-EXP8 |  | 「画像ファイル」の列には、そのカードの画像のファイル名を、追加した順に改行で区切って書く | ブラウザ E2E |
| TC-FT-IMPEXP-EXP9 |  | 画像のファイル名は「（カードの ID）-（画像の番号）.（拡張子）」とする（例: 1-12.jpeg） | ブラウザ E2E |
| TC-FT-IMPEXP-EXP10 |  | 画像の番号はシステム全体で画像ごとに振られる番号で、カードの中の連番ではない | ブラウザ E2E |
| TC-FT-IMPEXP-EXP11 |  | 拡張子は、画面から添えた画像は画像の形式による。インポートで取り込んだ画像は、取り込んだファイルの拡張子のままとする | ブラウザ E2E |
| TC-FT-IMPEXP-EXP12 |  | 画像はフォルダに分けず、zip のいちばん上に置く | ブラウザ E2E |
| TC-FT-IMPEXP-EXP13 | 画像のファイルがサーバーに無い場合 | その画像は zip に入れない（実装との乖離） | ブラウザ E2E |

- `対象外` `乖離` TC-FT-IMPEXP-EXP1: docs/ISSUES.md「エクスポートが失敗する」。今の挙動は tests/e2e/specs/features/import-export.spec.ts の【既知の問題】【実装との乖離】のテストで確かめる
- `対象外` `乖離` TC-FT-IMPEXP-EXP3: docs/ISSUES.md「エクスポートが失敗する」。今の挙動は tests/e2e/specs/features/import-export.spec.ts の【既知の問題】【実装との乖離】のテストで確かめる
- `対象外` `乖離` TC-FT-IMPEXP-EXP4: docs/ISSUES.md「エクスポートが失敗する」。今の挙動は tests/e2e/specs/features/import-export.spec.ts の【既知の問題】【実装との乖離】のテストで確かめる
- `対象外` `乖離` TC-FT-IMPEXP-EXP5: docs/ISSUES.md「エクスポートが失敗する」。今の挙動は tests/e2e/specs/features/import-export.spec.ts の【既知の問題】【実装との乖離】のテストで確かめる
- `対象外` `乖離` TC-FT-IMPEXP-EXP6: docs/ISSUES.md「エクスポートが失敗する」。今の挙動は tests/e2e/specs/features/import-export.spec.ts の【既知の問題】【実装との乖離】のテストで確かめる
- `対象外` `乖離` TC-FT-IMPEXP-EXP7: docs/ISSUES.md「エクスポートが失敗する」。今の挙動は tests/e2e/specs/features/import-export.spec.ts の【既知の問題】【実装との乖離】のテストで確かめる
- `対象外` `乖離` TC-FT-IMPEXP-EXP8: docs/ISSUES.md「エクスポートが失敗する」。今の挙動は tests/e2e/specs/features/import-export.spec.ts の【既知の問題】【実装との乖離】のテストで確かめる
- `対象外` `乖離` TC-FT-IMPEXP-EXP9: docs/ISSUES.md「エクスポートが失敗する」。今の挙動は tests/e2e/specs/features/import-export.spec.ts の【既知の問題】【実装との乖離】のテストで確かめる
- `対象外` `乖離` TC-FT-IMPEXP-EXP10: docs/ISSUES.md「エクスポートが失敗する」。今の挙動は tests/e2e/specs/features/import-export.spec.ts の【既知の問題】【実装との乖離】のテストで確かめる
- `対象外` `乖離` TC-FT-IMPEXP-EXP11: docs/ISSUES.md「エクスポートが失敗する」。今の挙動は tests/e2e/specs/features/import-export.spec.ts の【既知の問題】【実装との乖離】のテストで確かめる
- `対象外` `乖離` TC-FT-IMPEXP-EXP12: docs/ISSUES.md「エクスポートが失敗する」。今の挙動は tests/e2e/specs/features/import-export.spec.ts の【既知の問題】【実装との乖離】のテストで確かめる
- `対象外` `乖離` TC-FT-IMPEXP-EXP13: docs/ISSUES.md「画像のファイルが無いとエクスポートが終わらない」。今の挙動は tests/e2e/specs/features/import-export.spec.ts の【既知の問題】【実装との乖離】のテストで確かめる

### インポート

| ID | 前提（WHERE） | 異常（IF） | 結果 | 層 |
|---|---|---|---|---|
| TC-FT-IMPEXP-IMP1 |  |  | インポートできるのは、エクセル（xlsx）、CSV（UTF-8）、zip のファイルとする | ブラウザ E2E |
| TC-FT-IMPEXP-IMP2 |  |  | アップロードしたファイルは、すぐには取り込まず、毎分 0 秒に動く処理が順に取り込む | ブラウザ E2E |
| TC-FT-IMPEXP-IMP3 |  |  | 取り込むのは、すべてのプロジェクトを通じて、アップロードの古い順に 1 件ずつとする。前のインポートが終わるまで、次のインポートは始めない | ブラウザ E2E |
| TC-FT-IMPEXP-IMP4 | エクセル・CSV の場合 |  | 最初のシートの表を取り込む | ブラウザ E2E |
| TC-FT-IMPEXP-IMP5 | エクセル・CSV の場合 |  | 1 行目を項目名、2 行目以降をカードとする | ブラウザ E2E |
| TC-FT-IMPEXP-IMP6 | エクセル・CSV の場合 |  | 表の途中の空の行も、値が空のカードとして取り込む | ブラウザ E2E |
| TC-FT-IMPEXP-IMP7 | エクセル・CSV の場合 → 項目名がプロジェクトに無い場合 |  | その項目を末尾に追加する | ブラウザ E2E |
| TC-FT-IMPEXP-IMP8 | エクセル・CSV の場合 → プロジェクトにある項目がファイルに無い場合 |  | その項目の値は変えない | ブラウザ E2E |
| TC-FT-IMPEXP-IMP9 | エクセル・CSV の場合 |  | 「ID」の列は項目にせず、カードの ID として扱う（下の表） | ブラウザ E2E |
| TC-FT-IMPEXP-IMP10 | エクセル・CSV の場合 |  | 「画像ファイル」の列は項目にしない（エクセル・CSV の場合は列の値も使わない） | ブラウザ E2E |
| TC-FT-IMPEXP-IMP11 | エクセル・CSV の場合 |  | 新しいカードは、ファイルの行の順に、プロジェクトの末尾に置く | ブラウザ E2E |
| TC-FT-IMPEXP-IMP12 | zip の場合 |  | 中のエクセルまたは CSV のファイル 1 つを、上と同じように取り込む | ブラウザ E2E |
| TC-FT-IMPEXP-IMP13 | zip の場合 |  | エクセル・CSV のファイルは、名前が .xlsx・.csv（小文字）で終わるものを探す。macOS が作る __MACOSX フォルダの中のファイルは無視する | ブラウザ E2E |
| TC-FT-IMPEXP-IMP14 | zip の場合 → 「画像ファイル」の列がある場合 |  | 各行のカードの画像を、列に書いたファイル名の画像に置き換える | ブラウザ E2E |
| TC-FT-IMPEXP-IMP15 | zip の場合 → 「画像ファイル」の列がある場合 |  | ファイル名は、zip のいちばん上からのパスで書く | ブラウザ E2E |
| TC-FT-IMPEXP-IMP16 | zip の場合 → 「画像ファイル」の列がある場合 |  | ファイル名は、空白または改行で区切って複数書ける（実装との乖離） | ブラウザ E2E |
| TC-FT-IMPEXP-IMP17 | zip の場合 → 「画像ファイル」の列がある場合 → 列が空の場合 |  | そのカードの画像を消す | ブラウザ E2E |
| TC-FT-IMPEXP-IMP18 | zip の場合 → 「画像ファイル」の列が無い場合 |  | 画像は変えない | ブラウザ E2E |
| TC-FT-IMPEXP-IMP19 |  |  | 「ID」の列は、「同じIDのカードを上書きする」のチェックで扱いが変わる | ブラウザ E2E |
| TC-FT-IMPEXP-IMP20 |  |  | 新しく振るカードの ID は、プロジェクトのカードとファイルの「ID」の列の、いちばん大きい数字の次から振る | ブラウザ E2E |
| TC-FT-IMPEXP-IMP21 |  | ファイルに次の誤りがある場合 | 何も取り込まず、結果をフォーマットエラーとし、次の内容を記録する | ブラウザ E2E |
| TC-FT-IMPEXP-IMP22 |  | ファイルに次の誤りがある場合 | 行ごとの誤り（ID・画像ファイル）は、すべての行を確かめ、見つけた誤りを 1 件 1 行で記録する | ブラウザ E2E |
| TC-FT-IMPEXP-IMP23 |  | 取り込みの途中で予期しないエラーが起きた場合 | 結果をシステムエラーとし、エラーの内容を記録する（実装との乖離） | ブラウザ E2E |
| TC-FT-IMPEXP-IMP24 |  |  | 結果はプロジェクト設定のインポート履歴と、オーナーのテーブルビューに表示する | ブラウザ E2E |

- `対象外` `乖離` TC-FT-IMPEXP-IMP18: pages/project-settings.md「オーナー以外にはタブを表示しないが、URL を直接開くと「インポート」「ユーザー管理」「プロジェクト削除」の画面を表示する。（略）インポートはサーバー側のオーナー判定が効いておらず、取り込めてしまう」。今の挙動は tests/e2e/specs/features/import-export.import.spec.ts の【既知の問題】【実装との乖離】のテストで確かめる
- `対象外` `乖離` TC-FT-IMPEXP-IMP23: docs/ISSUES.md「画像ファイルの列で空白が続くとシステムエラーになり、途中まで取り込まれる」。今の挙動は tests/e2e/specs/features/import-export.import.spec.ts の【既知の問題】【実装との乖離】のテストで確かめる

| ID | 上書き | ID の値 | 取り込み方 | 層 |
|---|---|---|---|---|
| TC-FT-IMPEXP-IMP25 | しない | どれでも | 新しいカードを作る（ID は振り直す） | ブラウザ E2E |
| TC-FT-IMPEXP-IMP26 | する | 空 | 新しいカードを作る | ブラウザ E2E |
| TC-FT-IMPEXP-IMP27 | する | 数字で、その ID のカードがある | そのカードの値を、行の値で上書きする。空のセルは値を空にする。並び順は変えない | ブラウザ E2E |
| TC-FT-IMPEXP-IMP28 | する | 数字で、その ID のカードが無い | その ID で新しいカードを作る | ブラウザ E2E |

| ID | 誤り | 記録する内容 | 層 |
|---|---|---|---|
| TC-FT-IMPEXP-IMP29 | ID が数字でない行がある（上書きしない場合も確かめる） | 「{行}行目: IDは数字で入力してください」（行は見出しを除いて 1 から数える） | ブラウザ E2E |
| TC-FT-IMPEXP-IMP30 | 「画像ファイル」の列に書いた画像が zip に無い | 「{行}行目: 画像ファイル({ファイル名})が存在していません」 | ブラウザ E2E |
| TC-FT-IMPEXP-IMP31 | zip を展開できない | 「zipファイルの解凍に失敗しました」 | ブラウザ E2E |
| TC-FT-IMPEXP-IMP32 | zip にエクセル・CSV が無い | 「zip内にエクセル/CSVファイルが含まれていません」 | ブラウザ E2E |
| TC-FT-IMPEXP-IMP33 | zip にエクセル・CSV が 2 つ以上ある | 「zip内にエクセル/CSVファイルが複数含まれています」 | ブラウザ E2E |
| TC-FT-IMPEXP-IMP34 | 表に行が無い | 「エクセル/CSVファイルに行が存在していません」 | ブラウザ E2E |
| TC-FT-IMPEXP-IMP35 | 表に見出しの行しか無い | 「エクセル/CSVファイルにデータが存在していません」 | ブラウザ E2E |

### インポート中の画面

| ID | 区間（WHILE） | 操作（WHEN） | 結果 | 層 |
|---|---|---|---|---|
| TC-FT-IMPEXP-WAIT1 | プロジェクトのインポートを待っている間・取り込んでいる間は |  | そのプロジェクトの画面に「インポート中です」のダイアログを表示し、カードを操作させない（実装との乖離） | ブラウザ E2E |
| TC-FT-IMPEXP-WAIT2 | プロジェクトのインポートを待っている間・取り込んでいる間は |  | 「現在、（アップロードした日時） にアップロードされた （ファイル名） を処理中です。」と表示する | ブラウザ E2E |
| TC-FT-IMPEXP-WAIT3 | プロジェクトのインポートを待っている間・取り込んでいる間は |  | 「再読み込み」ボタンで、インポートが終わったかを確かめる | ブラウザ E2E |
| TC-FT-IMPEXP-WAIT4 | プロジェクトのインポートを待っている間・取り込んでいる間は |  | 30 秒ごとに、インポートが終わったかを自動で確かめる | ブラウザ E2E |
| TC-FT-IMPEXP-WAIT5 | プロジェクトのインポートを待っている間・取り込んでいる間は | インポートが終わると | ダイアログを閉じてカードを表示する | ブラウザ E2E |
| TC-FT-IMPEXP-WAIT6 | プロジェクトのインポートを待っている間・取り込んでいる間は |  | 「ホームに戻る」ボタンで、プロジェクト一覧に遷移する | ブラウザ E2E |
| TC-FT-IMPEXP-WAIT7 | インポート中は |  | そのプロジェクトを複製先に選べない（カードの複製） | ブラウザ E2E |
