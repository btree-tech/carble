import type { Page } from '@playwright/test'
import { open } from '../../support/navigation'

/**
 * 選択したカードの一括操作（「N件選択中」「複製」「削除」）
 * テーブルビューとグリッドビューに同じボタンがある。非表示の画面のボタンは役割で指すときに除かれる
 */
export class CardSelection {
  constructor(readonly page: Page) {}

  get countButton() {
    return this.page.getByRole('button', { name: /件選択中$/ })
  }

  get duplicateButton() {
    // ポップオーバーを開く要素（div role=button）が button を包むので、button だけを指す
    return this.page.getByRole('button', { name: '複製', exact: true }).and(this.page.locator('button'))
  }

  get deleteButton() {
    return this.page.getByRole('button', { name: '削除', exact: true })
  }
}

/**
 * グリッドビュー（/projects/:id/grid）の、選択に要る最小限のロケータ
 * グリッドビューそのもののページオブジェクトは別にある。ここでは選択の確認に要る部分だけを持つ
 */
export class GridSelection {
  constructor(readonly page: Page) {}

  async open(projectId: number) {
    await open(this.page, `/projects/${projectId}/grid`)
    await this.page.getByRole('link', { name: 'テーブルビュー' }).waitFor()
  }

  /** カード（表示項目の初期値は「画像」「ID」なので、「ID: N」の文言で指す） */
  card(cardId: number) {
    // カードは label 要素で、役割が無いため CSS で指す
    return this.page.locator('label').filter({ hasText: new RegExp(`ID: ${cardId}(?!\\d)`) })
  }

  checkbox(cardId: number) {
    return this.card(cardId).getByRole('checkbox')
  }

  get tableViewLink() {
    return this.page.getByRole('link', { name: 'テーブルビュー' })
  }
}
