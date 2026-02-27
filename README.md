# carble

## 使い方
下記URLを参照
https://docs.google.com/document/d/18VwKdzSuerLUq7XTI1r-wE-zRcZRWZbmZ6IDitwr77E/edit?tab=t.0

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


## 謝辞
このツールはまず科学研究費補助金（23K17486）によって開発され、その成果をひきついで「令和７年度　社会との共創によるデジタル・ヒューマニティーズ（DH）の推進」DHデータ構築補助事業の援助を受けて構築されました。
