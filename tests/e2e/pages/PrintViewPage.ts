import type { Locator, Page } from '@playwright/test'
import { open } from '../support/navigation'

/** カード印刷ビュー（/projects/:id/print、/projects/:id/cards/:cardId/print） */
export class PrintViewPage {
  constructor(readonly page: Page) {}

  async open(projectId: number, cardId?: number, query = '') {
    const path = cardId === undefined ? `/projects/${projectId}/print` : `/projects/${projectId}/cards/${cardId}/print`
    await open(this.page, `${path}${query ? `?${query}` : ''}`)
    await this.printButton.waitFor()
  }

  text(text: string) {
    return this.page.getByText(text, { exact: true }).filter({ visible: true })
  }

  get tableViewLink() {
    return this.page.getByRole('link', { name: 'テーブルビュー' })
  }

  get cardViewLink() {
    return this.page.getByRole('link', { name: 'カード入力ビュー' })
  }

  /** スマホ幅では文言を省くため名前が無い。省いた文言（非表示）を持つリンクで探す */
  iconLink(label: string) {
    return this.page.getByRole('link').filter({ has: this.page.getByText(label, { exact: true }) })
  }

  get printButton() {
    return this.page.getByRole('button', { name: '印刷' })
  }

  get layoutSelect() {
    return this.page.getByRole('combobox', { name: 'レイアウト' })
  }

  reservedSelect(n: number) {
    return this.page.getByRole('combobox', { name: `固定領域${n}` })
  }

  get reservedSelects() {
    return this.page.getByRole('combobox', { name: /^固定領域/ })
  }

  get imageCountInput() {
    return this.page.getByRole('spinbutton', { name: '表示画像枚数', exact: true })
  }

  get rowImageCountInput() {
    return this.page.getByRole('spinbutton', { name: '一行あたりの表示画像枚数' })
  }

  /** 「任意項目」の欄。入力欄に結び付いたラベルではないため、UFormGroup の構造で探す（やむを得ず XPath） */
  get optionalGroup() {
    return this.page.locator('xpath=//label[normalize-space()="任意項目"]/ancestor::div[3]')
  }

  /** 任意項目の行（名前と表示／非表示のボタン）。行には役割が無いため class で探す（やむを得ず CSS） */
  get optionalRows() {
    return this.optionalGroup.locator('div.flex.items-center')
  }

  async optionalNames() {
    return (await this.optionalRows.locator('div.grow').allTextContents()).map((t) => t.trim())
  }

  /** 任意項目の表示／非表示を切り替えるボタン（アイコンだけで名前が無い） */
  optionalToggle(name: string) {
    return this.optionalRows.filter({ has: this.page.getByText(name, { exact: true }) }).getByRole('button')
  }

  /**
   * プレビュー（印刷用のメディアでは、印刷するもの）のカード。
   * カードと領域には役割も名前も無いため、枠の class で探す（やむを得ず CSS）。
   * 画面では印刷用の複製が非表示、印刷用のメディアではプレビューが非表示になるので、見えているものに絞る
   */
  get cards() {
    return this.page.locator('div.grid.border.border-black').filter({ visible: true })
  }

  card(index = 0) {
    return this.cards.nth(index)
  }

  /** カードの領域。レイアウトの領域の番号の順に並ぶ */
  area(card: Locator, id: number) {
    return card.locator(':scope > div').nth(id - 1)
  }

  areas(card: Locator) {
    return card.locator(':scope > div')
  }

  /** QR コード（data URL の画像） */
  qrCode(scope: Locator) {
    return scope.locator('img[src^="data:"]')
  }

  /** カードの画像（元の画像） */
  photos(scope: Locator) {
    return scope.locator('img[src^="/uploads/images/"]')
  }

  /** 印刷する用紙（A4 1 枚ぶん）。役割が無いため class で探す（やむを得ず CSS） */
  get sheets() {
    return this.page.locator('.print-view-card-adjuster')
  }
}
