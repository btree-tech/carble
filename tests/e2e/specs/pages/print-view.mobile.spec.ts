import { expect, test } from '../../fixtures'
import { PrintViewPage } from '../../pages/PrintViewPage'
import { spec } from '../../support/spec'

test('スマホ幅の場合、ヘッダーのボタンの文言を省いてアイコンだけにする', spec('pages/print-view.md',
  'ヘッダー > WHERE スマホ幅の場合',
), async ({ ownerPage, ownerApi, project }) => {
  const card = await ownerApi.addCard(project.id)
  const print = new PrintViewPage(ownerPage)
  await print.open(project.id, card.id)

  for (const label of ['テーブルビュー', 'カード入力ビュー']) {
    await expect(print.iconLink(label)).toBeVisible()
    await expect(print.iconLink(label).getByText(label)).toBeHidden()
  }
  await expect(print.tableViewLink).toHaveCount(0)
  await expect(print.cardViewLink).toHaveCount(0)

  await print.iconLink('カード入力ビュー').click()
  await expect(ownerPage).toHaveURL(new RegExp(`/projects/${project.id}/cards/${card.id}\\?`))
})
