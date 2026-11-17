import { expect, type Page } from '@playwright/test'
import { open } from '../support/navigation'

/** ユーザー登録（/users/new）と設定（ユーザー）（/users/edit）。入力欄は同じ */
export class UserFormPage {
  constructor(readonly page: Page) {}

  async openNew() {
    await open(this.page, '/users/new')
    await this.waitForSession()
  }

  async openEdit() {
    await open(this.page, '/users/edit')
    await this.waitForSession()
  }

  /**
   * 入力欄に今のユーザーIDと名前が入るのを待つ
   * ハイドレーションの後にログイン状態を読み込んで入力欄を書き換えるので、その前に入れた値は消える
   */
  private async waitForSession() {
    await expect(this.name).not.toHaveValue('')
  }

  get username() {
    return this.page.getByLabel('ユーザーID')
  }

  get name() {
    return this.page.getByLabel('名前')
  }

  get usernameHelp() {
    return this.page.getByText('利用可能な文字: 半角英数およびハイフン（-）、アンダースコア（_）')
  }

  get saveButton() {
    return this.page.getByRole('button', { name: '保存' })
  }

  get deleteButton() {
    return this.page.getByRole('button', { name: 'ユーザーデータを削除' })
  }

  get links() {
    return this.page.getByRole('link')
  }

  /** 入力欄の下のメッセージ */
  message(text: string) {
    return this.page.getByText(text, { exact: true })
  }

  /** ユーザーIDの入力欄の読み込み中のアイコン（名前が無いので、アイコンの種類で探す） */
  static readonly USERNAME_LOADING = 'input[placeholder="carble"] ~ span [class*="progress-activity"]'

  async fillUsername(value: string) {
    await this.username.fill(value)
  }

  /**
   * 「保存」を押し、ユーザーを更新する要求の応答を待つ
   */
  async save() {
    const response = this.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/auth/update-user')
    await this.saveButton.click()
    return await response
  }

  /** 「ユーザーデータを削除」を押し、確認のダイアログに答える。ダイアログの文言を返す */
  async deleteUser(answer: 'accept' | 'dismiss') {
    // 確認のダイアログが開いている間は click が終わらないので、押す前に答え方を決めておく
    const message = new Promise<string>((resolve) => {
      this.page.once('dialog', async (dialog) => {
        resolve(dialog.message())
        if (answer === 'accept') await dialog.accept()
        else await dialog.dismiss()
      })
    })
    await this.deleteButton.click()
    return await message
  }
}
