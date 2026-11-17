import { randomBytes } from 'node:crypto'
import { test as base, type Page } from '@playwright/test'
import { ProductApi, type Project } from '../support/api'
import { saveCoverage, startCoverage } from '../support/coverage'
import { createAccount, deleteOpenImports, SESSION_COOKIE, type Account } from '../support/db'

type Fixtures = {
  /** このテストで作るデータに付ける一意な文字列（並列で動く他のテストのデータと区別する） */
  tag: string
  /**
   * このテスト専用のユーザーを作り、ログイン状態にする
   * ユーザーIDは tag と suffix から作る。username: null でユーザーID未登録のユーザー
   */
  newAccount: (values?: { suffix?: string, username?: string | null, name?: string }) => Promise<Account>
  /** ユーザーのログイン状態で画面を開く（guest はログインしていない画面） */
  pageAs: (account: Account | 'guest') => Promise<Page>
  /** ユーザーのログイン状態で製品の API を呼ぶ（前提データの作成） */
  apiAs: (account: Account) => Promise<ProductApi>
  /** このテストのオーナー（ユーザーID登録済み）と、そのプロジェクト */
  owner: Account
  ownerPage: Page
  ownerApi: ProductApi
  project: Project
}

export const test = base.extend<Fixtures>({
  tag: async ({}, use) => {
    await use(`t${randomBytes(4).toString('hex')}`)
  },

  newAccount: async ({ tag }, use) => {
    const accounts: Account[] = []
    await use(async (values = {}) => {
      const suffix = values.suffix ?? String(accounts.length + 1)
      const username = values.username === undefined ? `${tag}${suffix}` : values.username
      const account = createAccount({
        username,
        name: values.name ?? `利用者${tag}${suffix}`,
        email: `${tag}${suffix}@e2e.example.com`,
      })
      accounts.push(account)
      return account
    })
    // テストが取り込みを待たせたままのインポートを残さない（並列で流すと、インポートのテストの取り込みが遅れる）
    for (const account of accounts) deleteOpenImports(account.id)
  },

  pageAs: async ({ browser }, use) => {
    const contexts: Awaited<ReturnType<typeof browser.newContext>>[] = []
    const pages: Page[] = []
    await use(async (account) => {
      // テストの中の browser.newContext は、use の設定（baseURL・locale・timezoneId・画面幅）を引き継ぐ
      const context = await browser.newContext()
      if (account !== 'guest') {
        await context.addCookies([{ name: SESSION_COOKIE, value: account.sessionCookie, url: process.env.BASE_URL! }])
      }
      contexts.push(context)
      const page = await context.newPage()
      await startCoverage(page)
      pages.push(page)
      return page
    })
    for (const page of pages) await saveCoverage(page)
    for (const context of contexts) await context.close()
  },

  apiAs: async ({}, use) => {
    const apis: ProductApi[] = []
    await use(async (account) => {
      const api = await ProductApi.as(account)
      apis.push(api)
      return api
    })
    for (const api of apis) await api.dispose()
  },

  owner: async ({ newAccount }, use) => {
    await use(await newAccount({ suffix: 'owner' }))
  },

  ownerPage: async ({ pageAs, owner }, use) => {
    await use(await pageAs(owner))
  },

  ownerApi: async ({ apiAs, owner }, use) => {
    await use(await apiAs(owner))
  },

  project: async ({ ownerApi, tag }, use) => {
    await use(await ownerApi.createProject(`プロジェクト${tag}`))
  },
})

export { expect } from '@playwright/test'
