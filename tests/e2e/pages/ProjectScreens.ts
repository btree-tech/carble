import type { Locator, Page } from '@playwright/test'
import { open } from '../support/navigation'
import { Layout } from './components/Layout'

/**
 * プロジェクトの画面（テーブルビュー・カード入力ビュー・グリッドビュー・カード印刷ビュー・プロジェクト設定）の、
 * ロールと権限・画面共通の仕様を確かめるのに要る最小限のロケータ
 * 画面ごとの詳しい操作は、各画面のページオブジェクトにある
 */
export class ProjectScreens {
  readonly layout: Layout

  constructor(readonly page: Page) {
    this.layout = new Layout(page)
  }

  static paths(projectId: number, cardId?: number) {
    return {
      table: `/projects/${projectId}`,
      card: `/projects/${projectId}/cards/${cardId}`,
      grid: `/projects/${projectId}/grid`,
      print: `/projects/${projectId}/print`,
      settings: `/projects/${projectId}/settings`,
      settingsImport: `/projects/${projectId}/settings/import`,
      settingsUsers: `/projects/${projectId}/settings/users`,
      settingsDelete: `/projects/${projectId}/settings/delete`,
    }
  }

  async open(path: string) {
    await open(this.page, path)
  }

  // テーブルビュー

  /** ヘッダーのプロジェクト名の入力欄（名前が無いので、ヘッダーの最初の入力欄として探す） */
  get projectNameInput() {
    return this.page.getByRole('textbox').first()
  }

  /** テーブルビューの列の見出し（項目名など） */
  get tableColumnNames() {
    return this.page.locator('thead th')
  }

  /** テーブルビューのカードの行 */
  get tableRows() {
    return this.page.locator('tbody tr')
  }

  /** テーブルビューの「追加」 */
  get addCardButton() {
    return this.page.getByRole('button', { name: '追加', exact: true })
  }

  /**
   * テーブルビューの、あるカードのある項目の値の入力欄
   * 値の欄には名前が無いので、行（ID のセル）と列の位置で探す
   */
  tableCell(cardId: number, fieldIndex: number) {
    return this.tableRow(cardId).locator('td').nth(4 + fieldIndex).getByRole('textbox')
  }

  tableRow(cardId: number) {
    return this.tableRows.filter({ has: this.page.locator('td:nth-child(4)', { hasText: new RegExp(`^${cardId}$`) }) })
  }

  /** 値を押すと開く、編集用の入力欄 */
  get cellEditor() {
    return this.page.locator('textarea')
  }

  /** カードの行の「…」メニュー（名前が無いので、行の最後のボタンとして探す） */
  cardMenuButton(cardId: number) {
    return this.tableRow(cardId).locator('td').last().locator('button')
  }

  menuItem(name: string) {
    return this.page.getByRole('menuitem', { name, exact: true })
  }

  /** カードの行の選択のチェックボックス */
  cardCheckbox(cardId: number) {
    return this.tableRow(cardId).getByRole('checkbox')
  }

  /** 選択したカードの操作（「N件選択中」の並び） */
  selectionButton(name: '複製' | '削除') {
    // 「複製」はポップオーバーの外枠（role="button" の div）にも同じ名前が付くので、button 要素に絞る
    return this.page.getByRole('button', { name, exact: true }).and(this.page.locator('button'))
  }

  /** テーブルビューの項目の編集（見出しの右端の「…」）を開くボタン */
  get fieldMenuButton() {
    return this.page.locator('thead td').last().locator('button')
  }

  get newFieldInput() {
    return this.page.getByPlaceholder('項目名')
  }

  // カード入力ビュー

  /** カード入力ビューの項目の入力欄 */
  cardField(name: string) {
    return this.page.getByLabel(name, { exact: true })
  }

  /** カード入力ビューの「…」メニュー（名前が無いので、保存状態のアイコンの隣のボタンとして探す） */
  get cardViewMenuButton() {
    return this.page.locator('div.grow ~ div button').last()
  }

  get addImageButton() {
    return this.page.getByRole('button', { name: '画像を追加' })
  }

  get removeImageButton() {
    return this.page.getByRole('button', { name: '画像を削除' })
  }

  /** カード入力ビューの画像（サムネイル） */
  get cardImages() {
    return this.page.locator('img[src^="/uploads/thumbs/"]')
  }

  get scanButton() {
    return this.page.getByRole('button', { name: 'スキャン' })
  }

  // グリッドビュー

  /** グリッドビューのカード（「カード入力」のリンクを持つ枠） */
  get gridCards() {
    return this.page.locator('label', { has: this.page.getByRole('link', { name: 'カード入力' }) })
  }

  // カード印刷ビュー

  /** カード印刷ビューの QR コードの画像（data URL） */
  get qrCodes() {
    return this.page.locator('img[src^="data:image/png"]')
  }

  // プロジェクト設定

  /** プロジェクト設定のタブ */
  get settingsTabs() {
    return this.page.getByRole('navigation').getByRole('link')
  }

  settingsTab(name: string) {
    return this.page.getByRole('navigation').getByRole('link', { name, exact: true })
  }

  /** ユーザー管理の一覧の行 */
  userRow(username: string) {
    return this.page.getByRole('row').filter({ has: this.page.getByRole('cell', { name: username, exact: true }) })
  }

  /** ユーザー管理の一覧の行のセル。0: ユーザーID、1: 権限、2: ステータス、3: 操作 */
  userCell(username: string, column: 'username' | 'role' | 'status' | 'actions') {
    const index = { username: 0, role: 1, status: 2, actions: 3 }[column]
    return this.userRow(username).getByRole('cell').nth(index)
  }

  get inviteInput() {
    return this.page.getByPlaceholder('ユーザーIDを入力して招待')
  }

  get inviteButton() {
    return this.page.getByRole('button', { name: '招待', exact: true })
  }

  get deleteProjectButton() {
    return this.page.getByRole('button', { name: 'プロジェクトを削除する' })
  }

  get exportButton() {
    return this.page.getByRole('button', { name: 'エクスポート' })
  }

  /**
   * カード印刷ビューに出る、カードの QR コードを画像にする（スキャンに使う）
   * QR コードは余白なしで描かれ、そのままでは読み取れないことがあるので、白い余白を付けて大きく写す
   */
  async captureQrCode(projectId: number, cardId: number) {
    await this.open(`/projects/${projectId}/cards/${cardId}/print`)
    const src = await this.qrCodes.filter({ visible: true }).first().getAttribute('src')
    return await renderImage(this.page, `<img src="${src}" style="display:block;width:300px;height:300px;image-rendering:pixelated">`)
  }

  /** QR コードの無い画像（スキャンで新しいカードを作る・画像を添える） */
  async plainImage() {
    return await renderImage(this.page, '<div style="width:120px;height:80px;background:#3b82f6"></div>')
  }

  /** ファイルを選ぶ画面を開くボタンを押し、画像を選ぶ */
  async chooseImage(button: Locator, image: Buffer) {
    const chooser = this.page.waitForEvent('filechooser')
    await button.click()
    await (await chooser).setFiles({ name: 'image.png', mimeType: 'image/png', buffer: image })
  }

  /**
   * ある画面へのリンク（ボタン）
   * スマホ幅では文言を省いてアイコンだけになり、名前で探せないので、リンク先で探す
   */
  linkTo(path: string) {
    return this.page.locator(`a[href="${path}"]`).filter({ visible: true })
  }

  /** 画面に出ている文言（プロジェクト名など） */
  text(value: string): Locator {
    return this.page.getByText(value, { exact: true })
  }
}

/** HTML を白い余白付きで描き、PNG の画像にする（別のタブで描くので、開いている画面には触れない） */
async function renderImage(page: Page, html: string) {
  const canvas = await page.context().newPage()
  try {
    await canvas.setContent(`<div id="image" style="display:inline-block;padding:60px;background:#fff">${html}</div>`)
    return await canvas.locator('#image').screenshot()
  } finally {
    await canvas.close()
  }
}
