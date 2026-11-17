import { expect, test } from '../../fixtures/visual'
import { GridViewPage } from '../../pages/GridViewPage'
import { expectScreen } from '../../support/visual'

test.beforeEach(async ({ visualPage, sample }) => {
  const grid = new GridViewPage(visualPage)
  await grid.open(sample.project.id)
  await expect(grid.tiles).toHaveCount(3)
})

test('カードがある（表示項目は初期値の画像と ID）', { tag: ['@TC-PG-GRID-VRT1'] }, async ({ visualPage }) => {
  await expectScreen(visualPage)
})

test('1 件以上選んでいる', { tag: ['@TC-PG-GRID-VRT3'] }, async ({ visualPage }) => {
  const grid = new GridViewPage(visualPage)
  await grid.clickTile(0)
  await expect(grid.tileCheckbox(0)).toBeChecked()
  // マウスを乗せたタイルにもチェックボックスが出るので、タイルの外に外す
  await visualPage.mouse.move(0, 0)

  await expectScreen(visualPage)
})
