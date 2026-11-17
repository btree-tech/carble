import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from '@playwright/test'

/**
 * ブラウザ側のカバレッジ（E2E_COVERAGE=1 のときだけ。docker-compose.e2e.yml）
 *
 * 画面ごとに Chromium の V8 カバレッジを集め、共有のボリュームに書く。レポートは最後に scripts/coverage-report.mjs が作る。
 * スクリプトの本文は大きく、どの画面でも同じなので、URL ごとに 1 回だけ sources/ に書き、entries/ には実行した範囲だけを書く
 */
export const coverageEnabled = process.env.E2E_COVERAGE === '1'

const DIR = '/coverage/client'
const savedSources = new Set<string>()

export const sourceKey = (url: string) => createHash('sha1').update(url).digest('hex')

export async function startCoverage(page: Page) {
  if (!coverageEnabled) return
  await page.coverage.startJSCoverage({ resetOnNavigation: false })
}

export async function saveCoverage(page: Page) {
  if (!coverageEnabled || page.isClosed()) return
  // アプリのスクリプト（/_nuxt/）だけにする
  const entries = (await page.coverage.stopJSCoverage()).filter(({ url }) => new URL(url).pathname.startsWith('/_nuxt/'))
  if (!entries.length) return

  mkdirSync(join(DIR, 'sources'), { recursive: true })
  mkdirSync(join(DIR, 'entries'), { recursive: true })
  for (const { url, source } of entries) {
    const key = sourceKey(url)
    if (savedSources.has(key)) continue
    const file = join(DIR, 'sources', `${key}.json`)
    if (!existsSync(file)) writeFileSync(file, JSON.stringify({ url, source }))
    savedSources.add(key)
  }
  writeFileSync(
    join(DIR, 'entries', `${randomUUID()}.json`),
    JSON.stringify(entries.map(({ source: _, ...entry }) => entry)),
  )
}
