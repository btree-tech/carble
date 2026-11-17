import { expect, type Locator, type Page } from '@playwright/test'
import { icon } from '../TableViewPage'

export type CardMenuItem =
  | '直下に追加'
  | '直下に複製'
  | '末尾に複製'
  | '別プロジェクトに複製'
  | '複製元カードを表示'
  | '複製先カードを表示'
  | '削除'

/**
 * カードのメニュー「…」（テーブルビューの各行・カード入力ビューのヘッダー）
 * button は開くボタン。開いたメニューは画面に 1 つしか出ないので、項目は画面から指す
 */
export class CardMenu {
  constructor(readonly page: Page, readonly button: Locator) {}

  /** カード入力ビューのヘッダーの「…」（テーブルビューは非表示で残るので、表示しているものを指す） */
  static ofCardView(page: Page) {
    return new CardMenu(page, page.getByRole('button').filter({ has: icon(page, 'more-horiz') }).filter({ visible: true }).and(page.locator('button')))
  }

  async open() {
    await this.button.click()
    await this.page.getByRole('menu').waitFor()
  }

  item(name: CardMenuItem) {
    return this.page.getByRole('menu').getByRole('menuitem', { name, exact: true })
  }

  async choose(name: CardMenuItem) {
    // カード入力ビューで別のカードに移った直後は、画面の描き替えでメニューが閉じ、項目を押せないことがある。押せるまで開き直す
    // （押せなかったときは何も起きていないので、やり直してよい）
    await expect(async () => {
      if (!await this.item(name).isVisible()) await this.open()
      await this.item(name).click({ timeout: 2_000 })
    }).toPass({ timeout: 15_000 })
  }
}
