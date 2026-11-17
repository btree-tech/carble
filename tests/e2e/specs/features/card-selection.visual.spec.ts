import { expect, test } from '../../fixtures/visual'
import { CardSelection } from '../../pages/components/CardSelection'
import { DuplicateTargets } from '../../pages/components/DuplicateDialog'
import { TableViewPage } from '../../pages/TableViewPage'
import { expectScreen } from '../../support/visual'

test.beforeEach(async ({ visualPage, visualApi, sample }) => {
  await visualApi.createProject('植物標本の調査')
  const table = new TableViewPage(visualPage)
  await table.open(sample.project.id)
  await table.checkbox(sample.cards[0].id).check()
  await table.checkbox(sample.cards[1].id).check()
  await expect(new CardSelection(visualPage).countButton).toHaveText(/2件選択中/)
})

test('テーブルビューで 1 件以上選んでいる', { tag: ['@TC-FT-SELECT-VRT1'] }, async ({ visualPage }) => {
  await expectScreen(visualPage)
})

test('「複製」を押し、複製先のプロジェクトの一覧を開いた', { tag: ['@TC-FT-SELECT-VRT2'] }, async ({ visualPage }) => {
  await new CardSelection(visualPage).duplicateButton.click()
  await expect(DuplicateTargets.popover(visualPage).options).toHaveCount(2)

  await expectScreen(visualPage)
})
