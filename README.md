# carble

## ローカル開発
### 動作確認のみ
NODE_ENV=productionで動作する

```sh
$ cp .env.example .env
# ファイル内コメントを参考に編集
$ vim .env

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
