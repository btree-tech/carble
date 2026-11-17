import { expect, test } from '../../fixtures'
import { GridViewPage } from '../../pages/GridViewPage'
import { spec } from '../../support/spec'

test('スマホ幅の場合、「テーブルビュー」ボタンの文言を省いてアイコンだけにする', spec('pages/grid-view.md',
  'ヘッダー > プロジェクト名、「テーブルビュー」ボタン、保存状態のアイコンを表示する > WHERE スマホ幅の場合',
), async ({ ownerPage, ownerApi, project }) => {
  await ownerApi.addCard(project.id)
  const grid = new GridViewPage(ownerPage)
  await grid.open(project.id)

  await expect(grid.tableViewIconLink).toBeVisible()
  await expect(grid.tableViewIconLink.getByText('テーブルビュー')).toBeHidden()
  await expect(grid.tableViewLink).toHaveCount(0)

  await grid.tableViewIconLink.click()
  await expect(ownerPage).toHaveURL(`/projects/${project.id}`)
})
