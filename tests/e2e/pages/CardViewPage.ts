import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Locator, Page } from '@playwright/test'
import { open } from '../support/navigation'

/** tests/e2e/files/card/ のファイル */
export const cardFile = (name: string) => join(import.meta.dirname, '..', 'files', 'card', name)

/** API で取れるカード（画像を確かめるのに使う） */
export type CardDetail = {
  id: number
  projectId: number
  order: number
  images: { id: number, filename: string }[]
  contents: { fieldId: number, body: string | null }[]
}

/**
 * 画像の追加と、カードの取得（前提データ・結果の確かめ）
 * support/api.ts の ProductApi に画像の追加（multipart）が無いため、ログイン状態の画面の request で呼ぶ
 */
export async function addImageByApi(page: Page, projectId: number, cardId: number, file = 'red.png') {
  const response = await page.request.post(`/api/projects/${projectId}/cards/${cardId}/images`, {
    multipart: { image: { name: file, mimeType: 'image/png', buffer: readFileSync(cardFile(file)) } },
  })
  if (!response.ok()) throw new Error(`画像を追加できません: ${response.status()} ${await response.text()}`)
  return await response.json() as { id: number, filename: string }
}

export async function getCardByApi(page: Page, projectId: number, cardId: number) {
  const response = await page.request.get(`/api/projects/${projectId}/cards/${cardId}`)
  if (!response.ok()) throw new Error(`カードを取得できません: ${response.status()} ${await response.text()}`)
  return await response.json() as CardDetail
}

export async function listCardsByApi(page: Page, projectId: number, query = '') {
  const response = await page.request.get(`/api/projects/${projectId}/cards?sort=order${query}`)
  if (!response.ok()) throw new Error(`カードを取得できません: ${response.status()}`)
  return (await response.json() as { items: CardDetail[] }).items
}

/** 要素とその祖先の opacity を掛け合わせた値（マウスを乗せたときだけ見えるボタン・チェックボックスの確かめ） */
export async function effectiveOpacity(locator: Locator) {
  return await locator.evaluate((element) => {
    let opacity = 1
    for (let e: Element | null = element; e; e = e.parentElement) opacity *= Number(getComputedStyle(e).opacity)
    return opacity
  })
}

/** カード入力ビュー（/projects/:id/cards/:cardId） */
export class CardViewPage {
  constructor(readonly page: Page) {}

  async open(projectId: number, cardId: number, query = '') {
    await open(this.page, `/projects/${projectId}/cards/${cardId}${query ? `?${query}` : ''}`)
    await this.idValue.waitFor()
  }

  /** テーブルビュー（非表示）も同じ画面に描かれるため、見えているものに絞る */
  text(text: string) {
    return this.page.getByText(text, { exact: true }).filter({ visible: true })
  }

  get scanButton() {
    return this.page.getByRole('button', { name: 'スキャン' })
  }

  get tableViewLink() {
    return this.page.getByRole('link', { name: 'テーブルビュー' })
  }

  get printViewLink() {
    return this.page.getByRole('link', { name: 'カード印刷ビュー' })
  }

  /**
   * 保存状態のアイコン（保存したときのチェックの印）。
   * アイコンには名前が無いため、アイコンの class で探す（やむを得ず CSS）。保存前は透明で置いてある
   */
  get savedIcon() {
    return this.page.locator('[class*="i-material-symbols-light:done"]').filter({ visible: true })
  }

  /** カードのメニュー「…」。アイコンだけで名前が無いため、メニューのボタンの属性で探す（やむを得ず CSS） */
  get menuButton() {
    return this.page.locator('[aria-haspopup="menu"]').filter({ visible: true })
  }

  menuItem(name: string) {
    return this.page.getByRole('menuitem', { name })
  }

  async openMenu() {
    await this.menuButton.click()
    await this.menuItem('削除').waitFor()
  }

  /** 「ID」「並び順」など、入力欄の無い項目の値。ラベルに入力欄が結び付いていないため、UFormGroup の構造で探す（やむを得ず XPath） */
  formGroup(label: string) {
    return this.page.locator(`xpath=//label[normalize-space()="${label}"]/ancestor::div[3]`).filter({ visible: true })
  }

  get idValue() {
    return this.formGroup('ID')
  }

  get orderValue() {
    return this.formGroup('並び順')
  }

  field(name: string) {
    return this.page.getByRole('textbox', { name, exact: true })
  }

  /** 項目の入力欄（名前の分からないものも含めて、表示順に） */
  get fieldInputs() {
    return this.page.locator('textarea').filter({ visible: true })
  }

  /** 項目の下の「＋」。アイコンだけで名前が無いため、ポップオーバーのボタンの id で探す（やむを得ず CSS） */
  get addFieldButton() {
    return this.page.locator('[id^="headlessui-popover-button"]').filter({ visible: true })
  }

  get newFieldInput() {
    return this.page.getByRole('textbox', { name: '新しい項目を追加' })
  }

  get newFieldSubmit() {
    return this.page.locator('form').filter({ has: this.newFieldInput }).getByRole('button', { name: '追加', exact: true })
  }

  /** カードの画像（縮小した画像） */
  get images() {
    return this.page.getByRole('img').filter({ visible: true })
  }

  get showOriginalLinks() {
    return this.page.getByRole('link', { name: '元の画像を表示' })
  }

  get removeImageButtons() {
    return this.page.getByRole('button', { name: '画像を削除' })
  }

  get addImageButton() {
    return this.page.getByRole('button', { name: '画像を追加' })
  }

  /** 「画像を追加」を押し、開いた画像を選ぶ画面でファイルを選ぶ */
  async addImage(file: string) {
    const chooserPromise = this.page.waitForEvent('filechooser')
    await this.addImageButton.click()
    const chooser = await chooserPromise
    await chooser.setFiles(cardFile(file))
  }

  get previousLink() {
    return this.page.getByRole('link', { name: '前', exact: true })
  }

  get nextLink() {
    return this.page.getByRole('link', { name: '次', exact: true })
  }

  /** 次のカードが無いときの「追加」（ポップオーバーの「追加」と区別するため、ボタンの役割で絞る） */
  get addCardButton() {
    return this.page.getByRole('button', { name: '追加', exact: true }).filter({ visible: true })
  }

  toast(text: string) {
    return this.page.getByText(text, { exact: true })
  }

  /**
   * ダイアログ（「別プロジェクトに複製」「複製先カード」）。
   * role=dialog の要素は大きさが 0 で「見えない」扱いになるため、中のパネルを id で探す（やむを得ず CSS）
   */
  dialog(title: string) {
    return this.page.getByRole('dialog').locator('[id^="headlessui-dialog-panel"]').filter({ hasText: title })
  }
}
