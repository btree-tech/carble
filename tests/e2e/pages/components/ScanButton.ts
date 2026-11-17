import type { FileChooser, Page } from '@playwright/test'
import { open } from '../../support/navigation'
import { cardFile } from '../CardViewPage'

/** 「スキャン」ボタン（テーブルビュー・カード入力ビューのヘッダー） */
export class ScanButton {
  constructor(readonly page: Page) {}

  /** パソコン幅のボタン（文言が名前になる） */
  get button() {
    return this.page.getByRole('button', { name: 'スキャン' })
  }

  /** スマホ幅では文言を省くため名前が無い。省いた文言（非表示）を持つボタンで探す */
  get iconButton() {
    return this.page.getByRole('button').filter({ has: this.page.getByText('スキャン', { exact: true }) })
  }

  /** 「スキャン」を押し、開いた画像を選ぶ画面を返す */
  async openChooser(mobile = false): Promise<FileChooser> {
    const chooserPromise = this.page.waitForEvent('filechooser')
    await (mobile ? this.iconButton : this.button).click()
    return await chooserPromise
  }

  /** 「スキャン」を押して画像を選ぶ。file は files/card/ のファイル名か、画像のバイト列 */
  async scan(file: string | Buffer, mobile = false) {
    const chooser = await this.openChooser(mobile)
    await chooser.setFiles(typeof file === 'string'
      ? cardFile(file)
      : { name: 'scan.png', mimeType: 'image/png', buffer: file })
  }

  toast(text: string) {
    return this.page.getByText(text, { exact: true })
  }
}

/**
 * カード印刷ビューに出る、カードの QR コードの画像を作る（スキャンに使う）
 * QR コードの画像は余白なしで描かれるので、白い余白を付けて大きく写す
 */
export async function captureCardQrCode(page: Page, projectId: number, cardId: number) {
  await open(page, `/projects/${projectId}/cards/${cardId}/print`)
  const qr = page.locator('img[src^="data:"]').filter({ visible: true }).first()
  const src = await qr.getAttribute('src')
  if (!src) throw new Error('QR コードがありません')
  const canvas = await page.context().newPage()
  await canvas.setContent(`<div id="qr" style="display:inline-block;padding:60px;background:#fff"><img src="${src}" style="display:block;width:300px;height:300px;image-rendering:pixelated"></div>`)
  const image = await canvas.locator('#qr').screenshot()
  await canvas.close()
  return image
}
