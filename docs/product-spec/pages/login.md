# ログイン

パス: `/login`

## ユーザーストーリー（Why）

- 研究者が、Google アカウントでログインすることで、新しいパスワードを覚えずに使い始めたい（[CESCHI-204](https://kinako.atlassian.net/browse/CESCHI-204)）
  - 運営者が、メールアドレスを預からずに済むようにしたい（推測。「できればメールアドレスは取らない」の要望自体は [CESCHI-204](https://kinako.atlassian.net/browse/CESCHI-204) にあるが理由の記載なし）

## 外部仕様（What）

- ロゴと「Googleでログイン」ボタンを表示する
- **WHEN** 「Googleでログイン」を押すと、Google のログイン画面に遷移する
  - **WHEN** 初めてログインすると、[ユーザー登録](user-register.md)に遷移する
  - **WHEN** 登録済みのユーザーがログインすると、[プロジェクト一覧](project-list.md)に遷移する
    - **WHERE** ユーザーID をまだ登録していない場合、[ユーザー登録](user-register.md)に遷移する（[ロールと権限](../features/roles.md#ログイン)）
- **WHERE** ログインしている場合も、ログイン画面を表示する。[プロジェクト一覧](project-list.md)へは遷移しない
- **WHEN** [プロジェクト一覧](project-list.md)のユーザーメニューで「ログアウト」を選ぶと、ログアウトしてログイン画面に戻る

## 補足情報

### 実装との乖離

- 無し

### 関連機能

- [ロールと権限](../features/roles.md)
- [ユーザー登録](user-register.md)

### 変更履歴

- [CESCHI-217](https://kinako.atlassian.net/browse/CESCHI-217) ログイン画面のデザインを調整した
- [CESCHI-204](https://kinako.atlassian.net/browse/CESCHI-204) Google アカウントでのログインを追加した
- Confluence「仕様」から移植
