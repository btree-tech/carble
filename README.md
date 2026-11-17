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

## ドキュメント

| 文書 | 内容 |
|---|---|
| [docs/architecture/overview.md](docs/architecture/overview.md) | 技術概要（構成・画面と API・認証・データの流れ） |
| [docs/architecture/development.md](docs/architecture/development.md) | 開発環境・コマンド・マイグレーション・CLI・ブランチ |
| [docs/product-spec/](docs/product-spec/README.md) | 外部仕様（画面・機能ごとの仕様） |
| [docs/test-design/](docs/test-design/README.md) | テスト設計（外部仕様と E2E テストの対応） |
| [docs/ISSUES.md](docs/ISSUES.md) | 既知の問題 |
| [docs/plans/](docs/plans/) | 進行中の計画 |


## 謝辞
このツールはまず科学研究費補助金（23K17486）によって開発され、その成果をひきついで「令和７年度　社会との共創によるデジタル・ヒューマニティーズ（DH）の推進」DHデータ構築補助事業の援助を受けて構築されました。

Carble  © 2024 - present by Carble開発チーム is licensed under CC BY 4.0. To view a copy of this license, visit https://creativecommons.org/licenses/by/4.0/
