# Carble 外部仕様

Carble（カード型の研究データ蓄積・共有ツール）の外部仕様書。

## 構成

| ディレクトリ | 内容 |
|---|---|
| [pages/](pages/) | 画面単位の仕様 |
| [features/](features/) | 画面をまたぐ機能・共通事項・非機能要件 |
| [info/](info/) | 理解の助けとなる参考情報（用語・利用フロー・データモデルなど） |

## 記載ルール

- [writing-rules.md](writing-rules.md) に従う
- ユーザーストーリーの末尾に根拠の JIRA 課題を `（CESCHI-1234）` の形で示す。課題で動機を確認できないものは `（推測、確信度: 中）` のように明記する
- テスト設計は [docs/test-design](../test-design/README.md) に、仕様書と同じパスで置く

## 出典

| 出典 | 内容 |
|---|---|
| Confluence「[仕様](https://kinako.atlassian.net/wiki/spaces/CESCHI/pages/2991161345)」 | 2026-02-22 時点の仕様。初版の移植元 |
| JIRA CESCHI プロジェクト（Carble の課題） | ユーザーストーリーの根拠、2026-02 以降の改修内容（解決済みの課題のみ） |
| ソースコード（master `6751466`、2026-10-27 時点） | 改修内容の裏付け |

## 仕様書一覧

### pages（画面）

| 利用者 | 画面 | パス | 仕様書 |
|---|---|---|---|
| 共通 | ログイン | `/login` | [login.md](pages/login.md) |
| 共通 | ユーザー登録 | `/users/new` | [user-register.md](pages/user-register.md) |
| 共通 | 設定（ユーザー） | `/users/edit` | [user-settings.md](pages/user-settings.md) |
| 共通 | プロジェクト一覧（トップ） | `/` | [project-list.md](pages/project-list.md) |
| メンバー | テーブルビュー（プロジェクト詳細・カード一覧） | `/projects/:id` | [table-view.md](pages/table-view.md) |
| メンバー | カード入力ビュー | `/projects/:id/cards/:cardId` | [card-view.md](pages/card-view.md) |
| メンバー | グリッドビュー | `/projects/:id/grid` | [grid-view.md](pages/grid-view.md) |
| メンバー | カード印刷ビュー | `/projects/:id/print`, `/projects/:id/cards/:cardId/print` | [print-view.md](pages/print-view.md) |
| メンバー | プロジェクト設定 | `/projects/:id/settings`（`/import`, `/users`, `/delete`） | [project-settings.md](pages/project-settings.md) |

### features（機能・共通事項・非機能要件）

| 機能 | 仕様書 |
|---|---|
| ロールと権限 | [roles.md](features/roles.md) |
| 画面共通（完了メッセージ・保存状態・エラー画面） | [common-layout.md](features/common-layout.md) |
| カードの選択と一括操作 | [card-selection.md](features/card-selection.md) |
| カードの複製 | [card-duplicate.md](features/card-duplicate.md) |
| インポート・エクスポート | [import-export.md](features/import-export.md) |
| スキャン（QR コード） | [scan.md](features/scan.md) |
| 非機能要件 | [non-functional.md](features/non-functional.md) |

### info（参考情報）

| 内容 | ファイル |
|---|---|
| サービス概要（用語・利用フロー） | [overview.md](info/overview.md) |
| データモデル（テーブル構成・ER 図） | [data-model.md](info/data-model.md) |
