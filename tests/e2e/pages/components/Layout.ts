import type { Page } from '@playwright/test'

/**
 * 画面共通の部品（ユーザーメニュー・完了メッセージ・保存状態のアイコン・エラー画面）
 */
export class Layout {
  constructor(readonly page: Page) {}

  /**
   * ヘッダーの、ログインしているユーザーの名前のボタン
   * メニューの外枠（role="button" の div）にも同じ名前が付くので、button 要素に絞る
   */
  userMenuButton(name: string) {
    return this.page.getByRole('button', { name, exact: true }).and(this.page.locator('button'))
  }

  /** ユーザーメニューの項目（「設定」「ログアウト」） */
  menuItem(label: string) {
    return this.page.getByRole('menuitem', { name: label })
  }

  get menuItems() {
    return this.page.getByRole('menuitem')
  }

  async chooseUserMenu(name: string, label: '設定' | 'ログアウト') {
    await this.userMenuButton(name).click()
    await this.menuItem(label).click()
  }

  /** 画面の隅の完了メッセージ（Nuxt UI の通知は role="status"） */
  toast(title: string) {
    return this.page.getByRole('status').filter({ hasText: title })
  }

  /** 完了メッセージすべて */
  get toasts() {
    return this.page.getByRole('status')
  }

  /**
   * ヘッダーの保存状態のアイコン
   * アイコンには名前（アクセシブルネーム）が無いので、アイコンの種類（class）で探す
   */
  get savingIcon() {
    return this.page.locator(SPINNER).filter({ visible: true })
  }

  /**
   * 保存が終わったチェックのアイコン。保存する前は透明（opacity: 0）で置いてある
   * テーブルビュー以外の画面では、隠したテーブルビューのヘッダーも DOM に残るので、表示しているものに絞る
   */
  get savedIcon() {
    return this.page.locator('[class*="material-symbols-light:done"]').filter({ visible: true })
  }

  /** 保存に失敗した赤いエラーのアイコン（表示しているものに絞る） */
  get saveErrorIcon() {
    return this.page.locator('[class*="material-symbols-light:error"]').filter({ visible: true })
  }

  /** エラー画面のエラーの番号（Nuxt の標準のエラー画面は番号を h1 に出す） */
  errorCode(code: number) {
    return this.page.getByRole('heading', { level: 1, name: String(code), exact: true })
  }

  /**
   * 回転するアイコン（保存中・確かめている間の読み込み中）が一度でも表示されたかを記録し始める
   * 表示は一瞬で終わることがあるので、画面の中で変化を見張る（ネットワークや製品のコードは置き換えない）
   * 返した関数で、表示されたかどうかを取り出す
   */
  async watchSpinner(selector = SPINNER) {
    const key = `__spinnerSeen_${Math.random().toString(36).slice(2)}`
    await this.page.evaluate(({ selector, key }) => {
      const w = window as unknown as Record<string, boolean>
      w[key] = false
      const check = () => {
        for (const element of document.querySelectorAll<HTMLElement>(selector)) {
          if (element.getClientRects().length > 0 && getComputedStyle(element).display !== 'none') w[key] = true
        }
      }
      check()
      new MutationObserver(check).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class'] })
    }, { selector, key })
    return async () => await this.page.evaluate((key) => (window as unknown as Record<string, boolean>)[key], key)
  }
}

/** 回転するアイコン（Nuxt UI の読み込み中のアイコンと、保存状態の「保存中」） */
export const SPINNER = '.animate-spin[class*="progress-activity"]'
