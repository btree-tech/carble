import { defineConfig, devices } from '@playwright/test'

const isCI = !!process.env.CI

// ブラウザは利用者と同じ日本語・日本時間にする（app は UTC のまま）
const browserLocale = {
  locale: 'ja-JP',
  timezoneId: 'Asia/Tokyo',
}

export default defineConfig({
  testDir: '.',
  globalSetup: './global-setup.ts',
  outputDir: 'test-results',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // 全体の時間は、1 分に 1 件ずつ取り込むインポートのテスト（import のプロジェクト。順に流す）でほぼ決まるので、増やしても速くならない
  workers: 4,
  fullyParallel: true,
  forbidOnly: isCI,
  // リトライで通ったテスト（flaky）は html レポートで分かる
  retries: isCI ? 2 : 0,
  reporter: isCI
    ? [['line'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: process.env.BASE_URL,
    ...browserLocale,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      testMatch: /specs\/.*\.spec\.ts/,
      testIgnore: /\.(mobile|import|api)\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'], ...browserLocale },
    },
    {
      name: 'mobile',
      testMatch: /specs\/.*\.mobile\.spec\.ts/,
      use: { ...devices['Pixel 7'], ...browserLocale },
    },
    {
      // API E2E（*.api.spec.ts）。ブラウザを使わず、製品の API・ファイルの URL を直接呼んで応答を確かめる
      name: 'api',
      testMatch: /specs\/.*\.api\.spec\.ts/,
    },
    {
      // インポートは全プロジェクトを通じて 1 件ずつ、毎分の定期タスクで取り込まれる。
      // 並べて流すと待ちが積み重なるので、他と並行しつつ、このプロジェクトの中では順に流す
      name: 'import',
      testMatch: /specs\/.*\.import\.spec\.ts/,
      fullyParallel: false,
      // 1 つのテストで 2 回取り込みを待つことがあり、1 回ごとに support/imports.ts の IMPORT_TIMEOUT まで待つ
      timeout: 12 * 60_000,
      use: { ...devices['Desktop Chrome'], ...browserLocale },
    },
  ],
})
