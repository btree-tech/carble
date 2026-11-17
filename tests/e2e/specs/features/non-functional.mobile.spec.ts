import { devices, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { expect, test } from '../../fixtures'
import { CardViewPage } from '../../pages/CardViewPage'
import type { Field } from '../../support/api'
import { SESSION_COOKIE, type Account } from '../../support/db'

// このファイルの ownerPage はスマホ（Pixel 7。playwright.config.ts の mobile プロジェクト）。PC とタブレットの画面は、テストの中で端末を指定して開く

/** 端末（画面の大きさ・タッチ操作・ユーザーエージェント）を指定して、ユーザーのログイン状態の画面を開く。閉じるのは呼んだ側 */
async function pageOn(browser: Browser, contexts: BrowserContext[], device: 'Desktop Chrome' | 'iPad (gen 7)', account: Account) {
  const context = await browser.newContext(devices[device])
  contexts.push(context)
  await context.addCookies([{ name: SESSION_COOKIE, value: account.sessionCookie, url: process.env.BASE_URL! }])
  return await context.newPage()
}

/** カードのある項目の値の保存（自動保存）が終わるのを待つ */
function waitForSave(page: Page, projectId: number, cardId: number, field: Field) {
  const path = `/api/projects/${projectId}/cards/${cardId}/fields/${field.id}`
  return page.waitForResponse((r) => new URL(r.url()).pathname === path && r.request().method() === 'PUT' && r.ok())
}

test.describe('ユーザーストーリー', () => {
  test('研究者が、PC で題を入力したカードに、資料のある場所でスマホから画像とメモを足し、タブレットで同じカードを開いて PC とスマホの記録をまとめて見る', { tag: ['@story', '@TC-FT-NFR-US1'] }, async ({ browser, ownerPage, owner, ownerApi, project, tag }) => {
    const card = await ownerApi.addCard(project.id)
    const fields = await ownerApi.fields(project.id)
    const field = (name: string) => fields.find((f) => f.name === name)!
    const contexts: BrowserContext[] = []
    try {
      // PC で題を入力する
      const pc = new CardViewPage(await pageOn(browser, contexts, 'Desktop Chrome', owner))
      await pc.open(project.id, card.id)
      const pcSaved = waitForSave(pc.page, project.id, card.id, field('みだし'))
      await pc.field('みだし').fill(`PCで入力した題${tag}`)
      await pcSaved

      // 資料のある場所で、スマホから同じカードを開き、画像とメモを足す
      const phone = new CardViewPage(ownerPage)
      await phone.open(project.id, card.id)
      await expect(phone.field('みだし')).toHaveValue(`PCで入力した題${tag}`)
      await phone.addImage('red.png')
      await expect(phone.images).toHaveCount(1)
      const phoneSaved = waitForSave(ownerPage, project.id, card.id, field('メモ'))
      await phone.field('メモ').fill(`スマホで入力したメモ${tag}`)
      await phoneSaved

      // タブレットで開くと、PC とスマホで記録した内容がそろっている
      const tablet = new CardViewPage(await pageOn(browser, contexts, 'iPad (gen 7)', owner))
      await tablet.open(project.id, card.id)
      await expect(tablet.field('みだし')).toHaveValue(`PCで入力した題${tag}`)
      await expect(tablet.field('メモ')).toHaveValue(`スマホで入力したメモ${tag}`)
      await expect(tablet.images).toHaveCount(1)
    } finally {
      for (const context of contexts) await context.close()
    }
  })
})
