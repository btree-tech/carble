# 画面の E2E テストのランナー
# Playwright の公式イメージ（ブラウザと Node 入り）。版は package.json の @playwright/test と合わせる
FROM mcr.microsoft.com/playwright:v1.63.0-noble

# pnpm はホストと同じ版にする
RUN npm install -g pnpm@11.15.0 \
    && npm cache clean --force

WORKDIR /work/tests/e2e

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile \
    && rm -rf "$(pnpm store path)"
