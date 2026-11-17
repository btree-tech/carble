import { expect, test } from '../../fixtures/visual'
import { CardViewPage } from '../../pages/CardViewPage'
import { expectScreen } from '../../support/visual'

test('前後のカードがあり、画像がある', { tag: ['@TC-PG-CARD-VRT2'] }, async ({ visualPage, sample }) => {
  const card = new CardViewPage(visualPage)
  await card.open(sample.project.id, sample.cards[1].id)
  await expect(card.images).toHaveCount(1)

  await expectScreen(visualPage)
})
