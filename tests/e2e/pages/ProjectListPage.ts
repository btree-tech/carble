import type { Page } from '@playwright/test'
import { open } from '../support/navigation'
import { Layout } from './components/Layout'

/** プロジェクト一覧（/） */
export class ProjectListPage {
  readonly layout: Layout

  constructor(readonly page: Page) {
    this.layout = new Layout(page)
  }

  async open() {
    await open(this.page, '/')
  }

  /** ロゴ（文字の無い画像なので、h1 の見出しとして探す） */
  get logo() {
    return this.page.getByRole('heading', { level: 1 }).locator('svg')
  }

  // 招待の通知

  /** 招待の通知（「「（プロジェクト名）」に招待されています」の文言を含む枠） */
  invitation(projectName: string) {
    return this.page.locator('div', { has: this.page.getByText(`「${projectName}」に招待されています`, { exact: true }) })
      .filter({ has: this.page.getByRole('button', { name: '承認' }) })
      .last()
  }

  /** 招待の通知の文言（並び順を確かめる） */
  get invitationTitles() {
    return this.page.getByText(/^「.+」に招待されています$/)
  }

  acceptButton(projectName: string) {
    return this.invitation(projectName).getByRole('button', { name: '承認' })
  }

  denyButton(projectName: string) {
    return this.invitation(projectName).getByRole('button', { name: '拒否' })
  }

  // プロジェクトの一覧

  get table() {
    return this.page.getByRole('table')
  }

  get columnHeaders() {
    return this.table.getByRole('columnheader')
  }

  columnHeader(name: string) {
    return this.table.getByRole('columnheader', { name, exact: true })
  }

  /** 一覧の行（見出しの行を除く） */
  get rows() {
    return this.table.locator('tbody').getByRole('row')
  }

  row(projectName: string) {
    return this.rows.filter({ has: this.page.getByRole('cell', { name: projectName, exact: true }) })
  }

  /** 行のセル。列は 0: 詳細、1: プロジェクト名、2: オーナー、3: 最終更新日時 */
  cell(projectName: string, column: 'view' | 'name' | 'owner' | 'updatedAt') {
    const index = { view: 0, name: 1, owner: 2, updatedAt: 3 }[column]
    return this.row(projectName).getByRole('cell').nth(index)
  }

  /** 行の「詳細」（スマホ幅では文言が無く、テーブルビューへのリンクとして探す） */
  detailButton(projectName: string) {
    return this.row(projectName).getByRole('link')
  }

  /** 一覧のプロジェクト名（上から順） */
  get projectNames() {
    return this.rows.locator('td:nth-child(2)')
  }

  get emptyMessage() {
    return this.table.getByText('No items.', { exact: true })
  }

  // 新規プロジェクト

  /** 「新規プロジェクト」ボタン（スマホ幅では文言が無いので、一覧の上のメニューのボタンとして探す） */
  get newProjectButton() {
    // メニューの外枠（role="button" の div）にも同じ名前が付くので、button 要素に絞る
    return this.page.getByRole('button', { name: '新規プロジェクト' }).and(this.page.locator('button'))
  }

  /**
   * 「新規プロジェクト」のボタン（文言の有無を問わない）
   * スマホ幅では文言が無く名前で探せないので、一覧の表の直前にあるメニューのボタンとして探す
   */
  get newProjectMenuButton() {
    return this.page.locator('div:has(+ div table) [aria-haspopup] button')
  }

  get blankProjectItem() {
    return this.page.getByRole('menuitem', { name: '空白のプロジェクト' })
  }

  get importItem() {
    return this.page.getByRole('menuitem', { name: 'ファイルをインポート' })
  }

  // インポートのダイアログ

  /** インポートのダイアログ（role="dialog" の要素は大きさが無いので、中のパネルを探す） */
  get importDialog() {
    return this.page.getByRole('dialog').locator('[id^="headlessui-dialog-panel"]')
  }

  /**
   * 「ファイルを選択」ボタン
   * ボタンを包む label が名前の計算に割り込み、ボタンの名前が空になるので、文言で絞る
   */
  get chooseFileButton() {
    return this.importDialog.getByRole('button').filter({ hasText: /^ファイルを選択$/ })
  }

  get importButton() {
    return this.importDialog.getByRole('button', { name: 'インポート' })
  }

  get overwriteCheckbox() {
    return this.importDialog.getByLabel('同じIDのカードを上書きする')
  }

  async chooseFile(file: string | { name: string, mimeType: string, buffer: Buffer }) {
    const chooser = this.page.waitForEvent('filechooser')
    await this.chooseFileButton.click()
    await (await chooser).setFiles(file)
  }
}
