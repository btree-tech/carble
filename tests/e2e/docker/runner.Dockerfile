# 画面の E2E テストのランナー
# Playwright の公式イメージ（ブラウザと Node 入り）。版は package.json の @playwright/test と合わせる
FROM mcr.microsoft.com/playwright:v1.63.0-noble

# pnpm は tests/e2e/pnpm-lock.yaml を作った版にする（製品の packageManager とは別。runner の依存だけを入れる）
RUN npm install -g pnpm@11.15.0 \
    && npm cache clean --force

WORKDIR /work/tests/e2e

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile \
    && rm -rf "$(pnpm store path)"
