import type { Page } from '@playwright/test'

/**
 * 画面を開き、操作できるようになるまで待つ
 * サーバーで描いた HTML に先に入力やクリックをすると、Vue のハイドレーションで消えてしまう。
 * @nuxt/test-utils の goto と同じく、Nuxt の isHydrating が false になるのを待つ
 */
export async function open(page: Page, path: string) {
  await page.goto(path)
  await waitForHydration(page)
}

export async function waitForHydration(page: Page) {
  await page.waitForFunction(() => {
    try {
      return (window as unknown as { useNuxtApp?: () => { isHydrating: boolean } }).useNuxtApp?.().isHydrating === false
    } catch {
      return false
    }
  })
}
