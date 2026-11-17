import { expect, test } from '../../fixtures'
import { GridViewPage } from '../../pages/GridViewPage'

test('スマホ幅の場合、「テーブルビュー」ボタンの文言を省いてアイコンだけにする', { tag: ['@TC-PG-GRID-HDR3'] }, async ({ ownerPage, ownerApi, project }) => {
  await ownerApi.addCard(project.id)
  const grid = new GridViewPage(ownerPage)
  await grid.open(project.id)

  await expect(grid.tableViewIconLink).toBeVisible()
  await expect(grid.tableViewIconLink.getByText('テーブルビュー')).toBeHidden()
  await expect(grid.tableViewLink).toHaveCount(0)

  await grid.tableViewIconLink.click()
  await expect(ownerPage).toHaveURL(`/projects/${project.id}`)
})
