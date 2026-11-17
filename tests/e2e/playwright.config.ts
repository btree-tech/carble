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
  expect: {
    timeout: 10_000,
    // VRT（*.visual.spec.ts）。support/visual.ts の expectScreen が撮る
    toHaveScreenshot: { animations: 'disabled', caret: 'hide', scale: 'css' },
  },
  // VRT の正解の画像は、ルールの ID の名前で 1 か所に置く（ID はリポジトリ全体で重ならない）。
  // runner は手元も CI も同じ Linux のイメージなので、OS ごとに分けない（正解の画像は CI と同じ x64 で撮る。tests/e2e/README.md の「VRT」）
  snapshotPathTemplate: '{testDir}/snapshots/{arg}{ext}',
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
      testIgnore: /\.(mobile|import|api|visual)\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'], ...browserLocale },
    },
    {
      name: 'mobile',
      testMatch: /specs\/.*\.mobile\.spec\.ts$/,
      use: { ...devices['Pixel 7'], ...browserLocale },
    },
    {
      // API E2E（*.api.spec.ts）。ブラウザを使わず、製品の API・ファイルの URL を直接呼んで応答を確かめる
      name: 'api',
      testMatch: /specs\/.*\.api\.spec\.ts/,
    },
    {
      // VRT（*.visual.spec.ts）。画面を撮り、snapshots/ の正解の画像と比べる（docs/test-design/README.md の「見た目」）
      name: 'visual',
      testMatch: /specs\/.*\.visual\.spec\.ts$/,
      testIgnore: /\.mobile\.visual\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'], ...browserLocale },
    },
    {
      // スマホ幅の VRT（*.mobile.visual.spec.ts）
      name: 'visual-mobile',
      testMatch: /specs\/.*\.mobile\.visual\.spec\.ts$/,
      use: { ...devices['Pixel 7'], ...browserLocale },
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
