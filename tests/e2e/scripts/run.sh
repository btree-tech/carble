#!/usr/bin/env bash
# 画面の E2E テストを Docker で動かす（pnpm test:e2e）
# 環境を起動し、テストを流し、後片付けまで行う。引数はそのまま playwright test に渡す
#
# 環境変数（E2E_COVERAGE・E2E_RUNNER_AMD64 は docker-compose.e2e.yml も読む）
# - E2E_SKIP_BUILD=1: ビルド済みのイメージを使う（テストだけ直したとき用。製品のコードを変えたら付けない）
# - E2E_KEEP=1: 終わっても環境を止めない（続けて流すとき用。止めるときは E2E_DOWN=1 で実行する）
# - E2E_PROJECT: Docker Compose のプロジェクト名（既定 carble-e2e）。分けると、別の環境として同時に動かせる
# - E2E_COVERAGE=1: カバレッジを取り、tests/e2e/coverage/ にレポートを作る（app はソースマップ付きの別のイメージになる。
#   最後に app を止めてサーバー側の結果を書き出させる）
# - E2E_RUNNER_AMD64=1: runner を x64 で動かす（VRT の正解の画像を CI と同じ x64 で撮り直すとき）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
# app の形式は docker-compose.e2e.yml の platform（linux/amd64）で決める。
# DOCKER_DEFAULT_PLATFORM が設定されていると、それと食い違ってビルドできないので、このスクリプトの中では外す
unset DOCKER_DEFAULT_PLATFORM
COMPOSE=(docker compose -p "${E2E_PROJECT:-carble-e2e}" -f "$ROOT/docker-compose.e2e.yml")

if [ "${E2E_DOWN:-0}" = "1" ]; then
  "${COMPOSE[@]}" --profile runner down -v --remove-orphans
  exit 0
fi

cleanup() {
  # 環境が原因の失敗を後から追えるよう、コンテナを消す前に app のログを残す
  mkdir -p "$ROOT/tests/e2e/compose-logs"
  "${COMPOSE[@]}" logs --no-color app > "$ROOT/tests/e2e/compose-logs/compose.log" 2>&1 || true
  if [ "${E2E_KEEP:-0}" != "1" ]; then
    # DB とファイルのボリュームも消し、次はまっさらな状態から始める
    "${COMPOSE[@]}" --profile runner down -v --remove-orphans
  fi
}
trap cleanup EXIT

if [ "${E2E_SKIP_BUILD:-0}" != "1" ]; then
  "${COMPOSE[@]}" --profile runner build runner app
fi
"${COMPOSE[@]}" up -d --wait app
status=0
"${COMPOSE[@]}" --profile runner run --rm runner pnpm exec playwright test "$@" || status=$?

if [ "${E2E_COVERAGE:-0}" = "1" ]; then
  # サーバー側のカバレッジは、app のプロセスが終わるときに書き出される。テストが失敗しても、流れた分のレポートは作る
  "${COMPOSE[@]}" stop app
  "${COMPOSE[@]}" --profile runner run --rm --no-deps runner node scripts/coverage-report.mjs || status=$?
fi
exit "$status"
