import type { Page } from '@playwright/test'

/**
 * 複製先のプロジェクトの一覧
 * - カードのメニューの「別プロジェクトに複製」で開くダイアログ
 * - 選択したカードの「複製」で開くメニュー（ダイアログではなくポップオーバー）
 */
export class DuplicateTargets {
  private constructor(readonly page: Page, private readonly scope: ReturnType<Page['locator']>) {}

  /** 「別プロジェクトに複製」のダイアログ */
  static dialog(page: Page) {
    return new DuplicateTargets(page, page.getByRole('dialog').filter({ hasText: '別プロジェクトに複製' }))
  }

  /** 選択したカードの「複製」で開くメニュー（Headless UI のポップオーバー。役割が無いため id で指す） */
  static popover(page: Page) {
    return new DuplicateTargets(page, page.locator('[id^="headlessui-popover-panel"]').filter({ hasText: '新しいプロジェクト' }))
  }

  get root() {
    return this.scope
  }

  /** 一覧の項目（既存のプロジェクトと「新しいプロジェクト」）。並びの確認に使う */
  get options() {
    return this.scope.getByRole('button')
  }

  /** プロジェクト名の項目（「インポート中」のバッジが付くと名前が変わるので、文言の書き出しで指す） */
  project(name: string) {
    return this.options.filter({ hasText: name })
  }

  get newProject() {
    return this.options.filter({ hasText: '新しいプロジェクト' })
  }
}

/** 「複製先カード」のダイアログ */
export class DuplicatesDialog {
  constructor(readonly page: Page) {}

  get root() {
    return this.page.getByRole('dialog').filter({ hasText: '複製先カード' })
  }

  get links() {
    return this.root.getByRole('link')
  }

  link(name: string) {
    return this.root.getByRole('link', { name, exact: true })
  }
}
