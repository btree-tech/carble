# carble

## ローカル開発
### 動作確認のみ
NODE_ENV=productionで動作する

```sh
# ポート番号を変更したい場合のみ
$ cp .env.example .env

$ docker-compose up
```

### Visual Studio Code
1. Dev Containers拡張をインストール
2. `Ctrl+Shift+P` -> `Dev Containers: Reopen in Container`
3. `Ctrl+@` でターミナルを呼び出し、 `$ pnpm dev`

### dockerを使わない場合
```sh
# pnpmがインストールされていない場合のみ
$ npm install -g pnpm

$ pnpm install
$ pnpm dev
```

URL: http://localhost:3000
DBデータ確認: https://local.drizzle.studio

## デプロイ
1. AWS ECRにイメージをプッシュする
  ※ 手順はAWS ECR管理画面のプライベートレジストリでリポジトリを選択 -> 「プッシュコマンドの表示」で確認可能
2. ECSでサービスを選択→「サービスを更新」→「新しいデプロイを強制」にチェックを入れて更新

### EFSの中身にアクセス
EFSをマウントしたEC2インスタンスを立ち上げる
