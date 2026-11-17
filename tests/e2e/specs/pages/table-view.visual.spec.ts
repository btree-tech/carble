import { expect, test } from '../../fixtures/visual'
import { CardMenu } from '../../pages/components/CardMenu'
import { TableViewPage } from '../../pages/TableViewPage'
import { expectScreen } from '../../support/visual'

test.beforeEach(async ({ visualPage, sample }) => {
  const table = new TableViewPage(visualPage)
  await table.open(sample.project.id)
  await expect(table.rows).toHaveCount(3)
})

test('カードがある（画像のあるカードを含む）', { tag: ['@TC-PG-TABLE-VRT1'] }, async ({ visualPage }) => {
  await expectScreen(visualPage)
})

test('検索中', { tag: ['@TC-PG-TABLE-VRT3'] }, async ({ visualPage }) => {
  const table = new TableViewPage(visualPage)
  await table.search('チョウ')
  await expect(table.countText).toHaveText('1 / 3 件表示中')

  await expectScreen(visualPage)
})

test('見出しの右端の「…」を押し、「項目を編集」と「新しい項目を追加」を開いた', { tag: ['@TC-PG-TABLE-VRT4'] }, async ({ visualPage }) => {
  const table = new TableViewPage(visualPage)
  await table.fieldMenuButton.click()
  await expect(table.fieldNameInputs).toHaveCount(2)

  await expectScreen(visualPage)
})

test('行の「…」を押し、カードのメニューを開いた', { tag: ['@TC-PG-TABLE-VRT5'] }, async ({ visualPage }) => {
  const table = new TableViewPage(visualPage)
  await new CardMenu(visualPage, table.cardMenuButton(2)).open()

  await expectScreen(visualPage)
})
