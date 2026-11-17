import { expect, test } from '../../fixtures/visual'
import { TableViewPage } from '../../pages/TableViewPage'
import { expectScreen } from '../../support/visual'

test('カードがある（画像のあるカードを含む）', { tag: ['@TC-PG-TABLE-VRT2'] }, async ({ visualPage, sample }) => {
  const table = new TableViewPage(visualPage)
  await table.open(sample.project.id)
  await expect(table.rows).toHaveCount(3)

  await expectScreen(visualPage)
})
