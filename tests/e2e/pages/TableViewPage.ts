import type { Locator, Page } from '@playwright/test'
import { open } from '../support/navigation'

/**
 * アイコン（Nuxt UI の UIcon）を指す
 * アイコンには役割・文言が無く、class 属性（i-material-symbols-light:<名前>）でしか区別できないため CSS で指す
 */
export function icon(scope: Page | Locator, name: string) {
  return scope.locator(`.iconify[class*="i-material-symbols-light:${name} "]`)
}

/** テーブルビュー（/projects/:id） */
export class TableViewPage {
  constructor(readonly page: Page) {}

  async open(projectId: number, query = '') {
    await open(this.page, `/projects/${projectId}${query}`)
    await this.table.waitFor()
  }

  // ヘッダー

  /** 「ホーム」。スマホ幅では文言が無いので、アイコンで指す */
  get homeLink() {
    return this.page.getByRole('link').filter({ has: icon(this.page, 'home') })
  }

  /** プロジェクト名の入力欄。ラベルが無いため、ヘッダーで最初の入力欄として指す */
  get projectNameInput() {
    return this.page.getByRole('textbox').first()
  }

  get scanButton() {
    return this.page.getByRole('button', { name: 'スキャン' })
  }

  /** 「グリッドビュー」。スマホ幅では文言が無いので、アイコンで指す */
  get gridViewLink() {
    return this.page.getByRole('link').filter({ has: icon(this.page, 'grid-view') })
  }

  get printViewLink() {
    return this.page.getByRole('link').filter({ has: icon(this.page, 'print') })
  }

  get settingsLink() {
    return this.page.getByRole('link').filter({ has: icon(this.page, 'settings') })
  }

  /** 検索のフォーム（虫眼鏡のアイコンのある入力欄） */
  private get searchForm() {
    return this.page.locator('form').filter({ has: icon(this.page, 'search') })
  }

  get searchInput() {
    return this.searchForm.getByRole('textbox')
  }

  /** 検索の入力欄の「×」 */
  get searchClearButton() {
    return this.searchForm.getByRole('button').filter({ has: icon(this.page, 'close') })
  }

  async search(text: string) {
    await this.searchInput.fill(text)
    await this.searchInput.press('Enter')
  }

  /** 件数の表示（「全 N 件」「N / M 件表示中」） */
  get countText() {
    return this.searchForm.getByText(/件/)
  }

  /** 保存状態のアイコン（保存した） */
  get savedIcon() {
    return icon(this.page, 'done')
  }

  /** インポートの結果の通知 */
  importAlert(title: 'インポートが完了しました' | 'インポートに失敗しました') {
    return this.page.getByText(title, { exact: true })
  }

  get importAlertDetailLink() {
    return this.page.getByRole('link', { name: '詳細' })
  }

  /** 「インポート中です」のダイアログ（dialog の要素そのものは大きさが無いので、表示は見出しで確かめる） */
  get importingDialog() {
    return this.page.getByRole('dialog').filter({ hasText: 'インポート中です' })
  }

  get importingDialogTitle() {
    return this.importingDialog.getByText('インポート中です', { exact: true })
  }

  // カードの一覧

  get table() {
    return this.page.getByRole('table')
  }

  /** 見出しの行のセル（並び順、カード入力、選択、ID、項目…、メニュー） */
  get headerCells() {
    // 見出しの行には th と td が混ざり、役割（columnheader・cell）が分かれるため CSS で指す
    return this.table.getByRole('row').first().locator(':scope > *')
  }

  /** 列の見出しのリンク（並び順・ID・項目名） */
  sortLink(name: string) {
    return this.table.getByRole('row').first().getByRole('link', { name, exact: true })
  }

  /** 見出しの矢印（arrow-upward: 昇順、arrow-downward: 降順、swap-vert: 並び替えていない） */
  sortIcon(name: string, kind: 'arrow-upward' | 'arrow-downward' | 'swap-vert') {
    return icon(this.sortLink(name), kind)
  }

  /** カードの行（見出しを除く） */
  get rows() {
    // tbody の行だけを指す。見出しの行と区別する役割・文言が無いため CSS で指す
    return this.table.locator('tbody > tr')
  }

  /** 各行の ID の列（左から 4 列目）。列に見出しのラベルが結び付いていないため CSS で指す */
  get idCells() {
    return this.rows.locator(':scope > td:nth-child(4)')
  }

  /** 各行の並び順の列（左端） */
  get orderCells() {
    return this.rows.locator(':scope > td:nth-child(1)')
  }

  /** ID でカードの行を指す */
  row(cardId: number) {
    return this.rows.filter({ has: this.page.locator(':scope > td:nth-child(4)').getByText(String(cardId), { exact: true }) })
  }

  cardInputLink(cardId: number) {
    return this.row(cardId).getByRole('link').first()
  }

  checkbox(cardId: number) {
    return this.row(cardId).getByRole('checkbox')
  }

  get headerCheckbox() {
    return this.table.getByRole('row').first().getByRole('checkbox')
  }

  /** 見出しに表示している項目名（並び順・ID を除く） */
  async fieldNames() {
    const names = await this.table.getByRole('row').first().getByRole('link').allTextContents()
    return names.map((n) => n.trim()).filter((n) => n !== '並び順' && n !== 'ID')
  }

  /** カードの、ある項目のセル（1 行の入力欄） */
  async cellInput(cardId: number, fieldName: string) {
    const index = (await this.fieldNames()).indexOf(fieldName)
    if (index < 0) throw new Error(`項目「${fieldName}」の列がありません`)
    return this.row(cardId).locator(':scope > td').nth(4 + index).getByRole('textbox')
  }

  /** セルを押すと開く、複数行の入力欄（textarea。1 行の入力欄と役割が同じなので CSS で指す） */
  get cellEditor() {
    return this.page.locator('textarea')
  }

  /** 各行の「…」 */
  cardMenuButton(cardId: number) {
    // メニューのボタンには文言が無いため、行の最後のセルのボタンとして指す
    return this.row(cardId).locator(':scope > td').last().locator('button')
  }

  /** 一覧の下の「追加」。スマホ幅では文言が無いので、アイコンで指す */
  get addButton() {
    return this.page.getByRole('button').filter({ has: icon(this.page, 'add') }).last()
  }

  toast(title: string) {
    return this.page.getByText(title, { exact: true })
  }

  // 項目の編集

  /** 見出しの右端の「…」 */
  get fieldMenuButton() {
    return this.table.getByRole('row').first().locator(':scope > td').last().locator('button')
  }

  /** 「項目を編集」「新しい項目を追加」のパネル（Headless UI のポップオーバー。役割が無いため id で指す） */
  get fieldPanel() {
    return this.page.locator('[id^="headlessui-popover-panel"]').filter({ hasText: '項目を編集' })
  }

  /** 「項目を編集」の項目名の入力欄（項目の並び順） */
  get fieldNameInputs() {
    return this.fieldPanel.getByRole('textbox').and(this.page.locator(':not([placeholder="項目名"])'))
  }

  fieldHandles() {
    return this.fieldPanel.getByRole('button').filter({ has: icon(this.page, 'drag-indicator') })
  }

  /** 表示／非表示の切り替え（表示中は visibility、非表示は visibility-off のアイコン） */
  fieldVisibilityButtons() {
    return this.fieldPanel.getByRole('button').filter({ has: this.page.locator('[class*="i-material-symbols-light:visibility"]') })
  }

  fieldVisibilityIcon(index: number, kind: 'visibility' | 'visibility-off') {
    return icon(this.fieldVisibilityButtons().nth(index), kind)
  }

  fieldDeleteButtons() {
    return this.fieldPanel.getByRole('button').filter({ has: icon(this.page, 'delete-forever') })
  }

  get newFieldInput() {
    return this.fieldPanel.getByPlaceholder('項目名')
  }

  get newFieldButton() {
    return this.fieldPanel.getByRole('button', { name: '追加', exact: true })
  }

  /** SortableJS のつまみをドラッグする（dragTo では SortableJS が反応しないため、マウスを少しずつ動かす） */
  async drag(from: Locator, to: Locator) {
    await dragWithMouse(this.page, from, to, 'vertical')
  }
}

/**
 * SortableJS の並び替えをマウスで行い、from を to の前に置く
 * direction は並びの向き（縦に並ぶ一覧は vertical、横に並ぶグリッドは horizontal）
 */
export async function dragWithMouse(page: Page, from: Locator, to: Locator, direction: 'vertical' | 'horizontal') {
  const source = await from.boundingBox()
  const target = await to.boundingBox()
  if (!source || !target) throw new Error('ドラッグする要素が表示されていません')
  // 置く先は、to の前寄り（上端・左端の近く）
  const x = direction === 'horizontal' ? target.x + target.width * 0.2 : target.x + target.width / 2
  const y = direction === 'vertical' ? target.y + target.height * 0.2 : target.y + target.height / 2
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
  await page.mouse.down()
  await page.mouse.move(source.x + source.width / 2 + 5, source.y + source.height / 2 + 5, { steps: 5 })
  await page.mouse.move(x, y, { steps: 20 })
  await page.mouse.move(x + 1, y + 1, { steps: 5 })
  await page.mouse.up()
}
