import { expect, test } from '../../fixtures/visual'
import { GridViewPage } from '../../pages/GridViewPage'
import { expectScreen } from '../../support/visual'

test('カードがある（表示項目は初期値の画像と ID）', { tag: ['@TC-PG-GRID-VRT2'] }, async ({ visualPage, sample }) => {
  const grid = new GridViewPage(visualPage)
  await grid.open(sample.project.id)
  await expect(grid.tiles).toHaveCount(3)

  await expectScreen(visualPage)
})
