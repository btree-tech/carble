import { expect, test } from '../../fixtures/visual'
import { CardMenu } from '../../pages/components/CardMenu'
import { DuplicatesDialog, DuplicateTargets } from '../../pages/components/DuplicateDialog'
import { CardViewPage } from '../../pages/CardViewPage'
import { expectScreen } from '../../support/visual'

test('カードのメニューで「別プロジェクトに複製」を選び、複製先のプロジェクトを選ぶダイアログを開いた', { tag: ['@TC-FT-DUP-VRT1'] }, async ({ visualPage, visualApi, sample }) => {
  await visualApi.createProject('植物標本の調査')
  const card = new CardViewPage(visualPage)
  await card.open(sample.project.id, sample.cards[0].id)
  await CardMenu.ofCardView(visualPage).choose('別プロジェクトに複製')
  await expect(DuplicateTargets.dialog(visualPage).options).toHaveCount(2)

  await expectScreen(visualPage)
})

test('カードのメニューで「複製先カードを表示」を選び、複製先のカードを選ぶダイアログを開いた', { tag: ['@TC-FT-DUP-VRT2'] }, async ({ visualPage, visualApi, sample }) => {
  const other = await visualApi.createProject('植物標本の調査')
  await visualApi.call('post', `/api/projects/${sample.project.id}/cards/duplicate`, { cardId: [sample.cards[0].id], toProjectId: other.id })
  await visualApi.call('post', `/api/projects/${sample.project.id}/cards/duplicate`, { cardId: [sample.cards[0].id], toProjectId: sample.project.id })
  const card = new CardViewPage(visualPage)
  await card.open(sample.project.id, sample.cards[0].id)
  await CardMenu.ofCardView(visualPage).choose('複製先カードを表示')
  await expect(new DuplicatesDialog(visualPage).links).toHaveCount(2)

  await expectScreen(visualPage)
})
