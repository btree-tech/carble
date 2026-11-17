import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { expect, request, type Download, type Locator, type Page } from '@playwright/test'
import { SESSION_COOKIE, type Account } from '../support/db'
import { IMPORT_TIMEOUT } from '../support/imports'
import { open, waitForHydration } from '../support/navigation'

type Tab = '全般' | 'インポート' | 'ユーザー管理' | 'プロジェクト削除'

const TAB_PATHS: Record<Tab, string> = {
  全般: '',
  インポート: '/import',
  ユーザー管理: '/users',
  プロジェクト削除: '/delete',
}

/**
 * プロジェクト設定（/projects/:id/settings 以下）
 */
export class ProjectSettingsPage {
  constructor(readonly page: Page, readonly projectId: number) {}

  async open(tab: Tab = '全般') {
    await open(this.page, `/projects/${this.projectId}/settings${TAB_PATHS[tab]}`)
  }

  // ヘッダー

  projectName(name: string) {
    return this.page.getByText(name, { exact: true })
  }

  /** 「テーブルビュー」ボタン。スマホ幅では文言が無いので、遷移先で探す（アイコンだけのため名前で探せない） */
  get tableViewButton() {
    return this.page.locator(`a[href="/projects/${this.projectId}"]`)
  }

  get tableViewLabel() {
    return this.page.getByText('テーブルビュー', { exact: true })
  }

  /** タブ。開いているタブの名前は「Current page: 」から始まる */
  tab(name: Tab) {
    return this.page.getByRole('navigation').getByRole('link', { name: new RegExp(`(^|\\s)${name}$`) })
  }

  /** タブ（ヘッダーのナビゲーションの中のリンク） */
  get tabs() {
    return this.page.getByRole('navigation').getByRole('link')
  }

  // 全般

  get exportButton() {
    return this.page.getByRole('button', { name: 'エクスポート' })
  }

  /** 「エクスポート」を押し、ダウンロードを待つ */
  async export(): Promise<Download> {
    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      this.exportButton.click(),
    ])
    return download
  }

  // インポート

  /** 「ファイルを選択」ボタン（label の中にあり、アクセシブルな名前が付かないので文言で探す） */
  get chooseFileButton() {
    return this.page.getByRole('button').filter({ hasText: 'ファイルを選択' })
  }

  /** 選んだファイルの名前 */
  chosenFile(name: string) {
    return this.page.getByText(name, { exact: true })
  }

  get updateCheckbox() {
    return this.page.getByRole('checkbox', { name: '同じIDのカードを上書きする' })
  }

  get importButton() {
    return this.page.getByRole('button', { name: 'インポート', exact: true })
  }

  /** 「ファイルを選択」を押し、開いたファイルを選ぶ画面を返す */
  async openFileChooser() {
    const [chooser] = await Promise.all([
      this.page.waitForEvent('filechooser'),
      this.chooseFileButton.click(),
    ])
    return chooser
  }

  async chooseFile(file: string | { name: string, mimeType: string, buffer: Buffer }) {
    const chooser = await this.openFileChooser()
    await chooser.setFiles(file)
  }

  /** 「インポート」を押す */
  async startImport() {
    await this.importButton.click()
  }

  /** 「同じIDのカードを上書きする」をチェックし、出たダイアログを「OK」で閉じる */
  async checkUpdate() {
    await this.updateCheckbox.check()
    await this.okButton.click()
    await expect(this.okButton).toBeHidden()
  }

  /**
   * 上書きのダイアログ
   * ダイアログの要素そのものは大きさが 0 で「見えない」と判定されるので、中身で確かめる
   */
  get dialog() {
    return this.page.getByRole('dialog')
  }

  get okButton() {
    return this.dialog.getByRole('button', { name: 'OK' })
  }

  /** インポート履歴の表 */
  get historyTable() {
    return this.page.getByRole('table')
  }

  /** インポート履歴の行（見出しの行を除く） */
  get historyRows() {
    return this.historyTable.getByRole('row').filter({ hasNot: this.page.getByRole('columnheader') })
  }

  historyRow(filename: string) {
    return this.historyRows.filter({ hasText: filename })
  }

  /** 行の「インポート日時」「ファイル名」「結果」のセル（行を開くボタンのセルを除く） */
  historyCell(row: Locator, column: 'インポート日時' | 'ファイル名' | '結果') {
    const index = { インポート日時: 0, ファイル名: 1, 結果: 2 }[column]
    // 先頭のセルは行を開くボタン
    return row.getByRole('cell').nth(index + 1)
  }

  /** 行を開くボタン（フォーマットエラー・システムエラーの行だけ表示する） */
  expandButton(row: Locator) {
    return row.getByRole('button')
  }

  get pagination() {
    return this.page.getByRole('button', { name: /^\d+$/ })
  }

  pageButton(page: number) {
    return this.page.getByRole('button', { name: String(page), exact: true })
  }

  /**
   * インポート履歴を読み直す（タブを「全般」→「インポート」と切り替える）
   * 画面を読み込み直すと、インポート中はエラー画面になる（docs/ISSUES.md「インポート中にプロジェクトの画面を直接開くとエラー画面になる」）ため、画面の中の遷移で読み直す
   */
  async reloadHistory() {
    await this.tab('全般').click()
    await expect(this.exportButton).toBeVisible()
    await this.tab('インポート').click()
    await expect(this.historyTable).toBeVisible()
    await expect(this.page.getByRole('row').getByText('Loading...')).toHaveCount(0)
  }

  /** インポート履歴で、ファイルの結果が「未処理」「インポート中」以外になるまで読み直す */
  async waitForImportResult(filename: string, timeout = IMPORT_TIMEOUT) {
    await expect(async () => {
      await this.reloadHistory()
      await expect(this.historyCell(this.historyRow(filename).first(), '結果')).not.toHaveText(/未処理|インポート中/, { timeout: 1_000 })
    }).toPass({ timeout, intervals: [1_000, 2_000, 3_000] })
  }

  // ユーザー管理

  get usersTable() {
    return this.page.getByRole('table')
  }

  get userRows() {
    return this.usersTable.getByRole('row').filter({ hasNot: this.page.getByRole('columnheader') })
  }

  userRow(username: string) {
    return this.userRows.filter({ has: this.page.getByRole('cell', { name: username, exact: true }) })
  }

  get inviteInput() {
    return this.page.getByPlaceholder('ユーザーIDを入力して招待')
  }

  get inviteButton() {
    return this.page.getByRole('button', { name: '招待' })
  }

  async invite(username: string) {
    await this.inviteInput.fill(username)
    await this.inviteButton.click()
  }

  // プロジェクト削除

  get deleteProjectButton() {
    return this.page.getByRole('button', { name: 'プロジェクトを削除する' })
  }
}

/**
 * プロジェクトの画面のうち、設定のテストで使う最小限のロケータ
 * （テーブルビュー・カード入力ビューの詳しい操作は、それぞれのページオブジェクトで扱う）
 */
export class ProjectScreen {
  constructor(readonly page: Page, readonly projectId: number) {}

  async openTableView() {
    await open(this.page, `/projects/${this.projectId}`)
  }

  async openCard(cardId: number) {
    await open(this.page, `/projects/${this.projectId}/cards/${cardId}`)
  }

  // インポート中のダイアログ

  /** 「インポート中です」のダイアログ（ダイアログの要素は大きさが 0 なので、見出しで確かめる） */
  get importingDialog() {
    return this.page.getByText('インポート中です', { exact: true })
  }

  get importingMessage() {
    return this.page.getByText(/^現在、/)
  }

  get reloadButton() {
    return this.page.getByRole('button', { name: '再読み込み' })
  }

  get homeButton() {
    return this.page.getByRole('link', { name: 'ホームに戻る' })
  }

  // テーブルビュー

  get table() {
    return this.page.getByRole('table')
  }

  /** 見出しの行（並び順・ID・表示している項目の名前） */
  get headerRow() {
    return this.table.getByRole('row').first()
  }

  get cardRows() {
    return this.table.getByRole('row').filter({ hasNot: this.page.getByRole('columnheader') })
  }

  /** カードの行のセル: 0 並び順、3 ID */
  orderCell(row: Locator) {
    return row.getByRole('cell').nth(0)
  }

  idCell(row: Locator) {
    return row.getByRole('cell').nth(3)
  }

  /** 行の項目の値（表示している項目の順） */
  values(row: Locator) {
    return row.getByRole('textbox')
  }

  get importedAlert() {
    return this.page.getByText('インポートが完了しました')
  }

  get failedAlert() {
    return this.page.getByText('インポートに失敗しました')
  }

  // カード入力ビュー

  /** カードの画像（縮小した画像） */
  get cardImages() {
    return this.page.getByRole('img')
  }

  /** インポートが終わり、ダイアログが閉じるまで待つ（ダイアログは 30 秒ごとに自動で確かめる） */
  async waitForImportDone(timeout = IMPORT_TIMEOUT) {
    await expect(this.importingDialog).toBeHidden({ timeout })
    await waitForHydration(this.page)
  }
}

// ---------------------------------------------------------------------------
// 前提データ（support/api.ts はファイルを送れないので、ここで multipart で送る）

async function apiContext(account: Account) {
  return await request.newContext({
    baseURL: process.env.BASE_URL,
    extraHTTPHeaders: { cookie: `${SESSION_COOKIE}=${account.sessionCookie}` },
  })
}

export type ImportFile = { name: string, mimeType: string, buffer: Buffer }

export const MIME = {
  csv: 'text/csv',
  zip: 'application/zip',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  png: 'image/png',
} as const

/** tests/e2e/files/settings/ のファイルのパス */
export function settingsFile(name: string) {
  return fileURLToPath(new URL(`../files/settings/${name}`, import.meta.url))
}

/** tests/e2e/files/settings/ のファイルを、アップロードする形で読む */
export async function fileOf(name: string, mimeType: string): Promise<ImportFile> {
  return { name, mimeType, buffer: await readFile(settingsFile(name)) }
}

/** インポートのファイルをアップロードする（製品の API。画面の「インポート」と同じ送り方） */
export async function uploadImport(account: Account, projectId: number, file: ImportFile, update = false) {
  const context = await apiContext(account)
  try {
    const response = await context.post(`/api/projects/${projectId}/imports`, {
      multipart: { file, update: String(update) },
    })
    if (!response.ok()) throw new Error(`POST imports: ${response.status()} ${await response.text()}`)
    return await response.json() as { id: number, filename: string }
  } finally {
    await context.dispose()
  }
}

/** カードに画像を添える（製品の API。カード入力ビューの「画像を追加」と同じ送り方） */
export async function addImage(account: Account, projectId: number, cardId: number, file: ImportFile) {
  const context = await apiContext(account)
  try {
    const response = await context.post(`/api/projects/${projectId}/cards/${cardId}/images`, {
      multipart: { image: file },
    })
    if (!response.ok()) throw new Error(`POST images: ${response.status()} ${await response.text()}`)
    return await response.json() as { id: number, filename: string }
  } finally {
    await context.dispose()
  }
}

/**
 * 表計算ソフトで作った CSV（Excel の「CSV UTF-8」と同じ BOM 付き）をアップロードする形で作る
 * BOM の無い UTF-8 は日本語が文字化けする（docs/ISSUES.md「BOM の無い UTF-8 の CSV は文字化けする」）ので、必ず BOM を付ける
 * セルに「,」「"」・改行を含めない（エスケープしない）
 */
export function bomCsv(name: string, rows: string[][]): ImportFile {
  const text = rows.map((row) => row.join(',')).join('\n') + '\n'
  return { name, mimeType: MIME.csv, buffer: Buffer.from(`﻿${text}`) }
}

/** 端末（ブラウザ）の日時を「年月日時分秒」にする。ブラウザは Asia/Tokyo（playwright.config.ts） */
export function tokyoTimestamp(date: Date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date).map((p) => [p.type, p.value]))
  return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`
}

/** 画面の日時の表示（ja-JP の medium。例: 2026/10/28 12:34:56）を Date にする（Asia/Tokyo） */
export function parseDisplayedDate(text: string) {
  const m = text.trim().match(/^(\d{4})\/(\d{1,2})\/(\d{1,2}) (\d{1,2}):(\d{2}):(\d{2})$/)
  if (!m) throw new Error(`日時の表示ではありません: ${text}`)
  const [, y, mo, d, h, mi, s] = m.map(Number)
  return new Date(Date.UTC(y, mo - 1, d, h - 9, mi, s))
}
