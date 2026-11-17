import { expect, test } from '../../fixtures'
import { CardViewPage } from '../../pages/CardViewPage'
import { ScanButton } from '../../pages/components/ScanButton'
import { open } from '../../support/navigation'

test('スマホ幅の場合、「スキャン」の文言を省いてアイコンだけにする', { tag: ['@TC-FT-SCAN-GEN2'] }, async ({ ownerPage, ownerApi, project }) => {
  const card = await ownerApi.addCard(project.id)
  const scan = new ScanButton(ownerPage)

  for (const openPage of [
    () => open(ownerPage, `/projects/${project.id}`),
    () => new CardViewPage(ownerPage).open(project.id, card.id),
  ]) {
    await openPage()
    await expect(scan.iconButton).toBeVisible()
    await expect(scan.iconButton.getByText('スキャン')).toBeHidden()
    await expect(scan.button).toHaveCount(0)
    // アイコンだけでも、押すと画像を選ぶ画面を開く
    await scan.openChooser(true)
  }
})
