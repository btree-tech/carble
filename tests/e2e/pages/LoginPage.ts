import type { Page } from '@playwright/test'
import { open } from '../support/navigation'

/** ログイン（/login） */
export class LoginPage {
  constructor(readonly page: Page) {}

  async open() {
    await open(this.page, '/login')
  }

  /** ロゴ（文字の無い画像なので、h1 の見出しとして探す） */
  get logo() {
    return this.page.getByRole('heading', { level: 1 }).locator('svg')
  }

  get googleButton() {
    return this.page.getByRole('button', { name: 'Googleでログイン' })
  }

  /**
   * 「Googleでログイン」を押し、Better Auth へのログインの要求と、その後の Google への遷移の要求を返す
   * Google の画面そのものは開かない（要求が出たところまで）
   */
  async signInWithGoogle() {
    const google = this.page.waitForRequest((request) => new URL(request.url()).hostname === 'accounts.google.com')
    // app の SQLite は、並列で動く他のテストがログインを仕込む書き込みと重なると SQLITE_BUSY で 500 を返すことがある。
    // そのときは、利用者がもう一度押すのと同じく押し直す（Google への遷移が始まらないので画面はそのまま）
    for (let attempt = 1; ; attempt++) {
      const response = this.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/auth/sign-in/social')
      await this.googleButton.click()
      const signIn = await response
      if (signIn.ok() || attempt >= 3) return { signIn: signIn.request(), google: await google }
    }
  }
}
