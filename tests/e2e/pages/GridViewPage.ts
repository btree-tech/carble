import type { Page } from '@playwright/test'
import { open } from '../support/navigation'

/** グリッドビュー（/projects/:id/grid） */
export class GridViewPage {
  constructor(readonly page: Page) {}

  async open(projectId: number) {
    await open(this.page, `/projects/${projectId}/grid`)
    await this.fieldSelect(1).waitFor()
  }

  text(text: string) {
    return this.page.getByText(text, { exact: true }).filter({ visible: true })
  }

  get tableViewLink() {
    return this.page.getByRole('link', { name: 'テーブルビュー' })
  }

  /** スマホ幅では文言を省くため名前が無い。省いた文言（非表示）を持つリンクで探す */
  get tableViewIconLink() {
    return this.page.getByRole('link').filter({ has: this.page.getByText('テーブルビュー', { exact: true }) })
  }

  /** 並び替えの保存状態のアイコン（保存したときのチェックの印）。名前が無いため class で探す（やむを得ず CSS） */
  get savedIcon() {
    return this.page.locator('[class*="i-material-symbols-light:done"]').filter({ visible: true })
  }

  fieldSelect(n: 1 | 2) {
    return this.page.getByRole('combobox', { name: `表示項目${n}` })
  }

  /** タイル。役割も名前も無い label 要素なので、「カード入力」を持つ label で探す（やむを得ず CSS） */
  get tiles() {
    return this.page.locator('label').filter({ has: this.page.getByRole('link', { name: 'カード入力' }) }).filter({ visible: true })
  }

  tile(index: number) {
    return this.tiles.nth(index)
  }

  tileCheckbox(index: number) {
    return this.tile(index).getByRole('checkbox')
  }

  tileCardLink(index: number) {
    return this.tile(index).getByRole('link', { name: 'カード入力' })
  }

  tileImage(index: number) {
    return this.tile(index).getByRole('img')
  }

  /** 選んだタイルに重ねる色。役割の無い装飾なので class で探す（やむを得ず CSS） */
  tileHighlight(index: number) {
    return this.tile(index).locator('div.absolute.inset-0')
  }

  /** タイルの「カード入力」以外の場所（左上）を押す */
  async clickTile(index: number, modifiers: ('Shift')[] = []) {
    await this.tile(index).click({ position: { x: 12, y: 12 }, modifiers })
  }
}
