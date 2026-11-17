import { expect, test } from '../../fixtures/visual'
import { Layout } from '../../pages/components/Layout'
import { expectScreen } from '../../support/visual'

test('存在しない画面を開いた（エラー画面）', { tag: ['@TC-FT-LAYOUT-VRT1'] }, async ({ visualPage }) => {
  await visualPage.goto('/not-found')
  await expect(new Layout(visualPage).errorCode(404)).toBeVisible()

  await expectScreen(visualPage)
})
