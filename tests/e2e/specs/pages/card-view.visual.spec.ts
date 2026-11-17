import { expect, test } from '../../fixtures/visual'
import { CardMenu } from '../../pages/components/CardMenu'
import { CardViewPage } from '../../pages/CardViewPage'
import { expectScreen } from '../../support/visual'

test('前後のカードがあり、画像がある', { tag: ['@TC-PG-CARD-VRT1'] }, async ({ visualPage, sample }) => {
  const card = new CardViewPage(visualPage)
  await card.open(sample.project.id, sample.cards[1].id)
  await expect(card.images).toHaveCount(1)

  await expectScreen(visualPage)
})

test('次のカードが無く、「＋」を押して「新しい項目を追加」の入力欄を開いた', { tag: ['@TC-PG-CARD-VRT3'] }, async ({ visualPage, sample }) => {
  const card = new CardViewPage(visualPage)
  await card.open(sample.project.id, sample.cards[2].id)
  await expect(card.addCardButton).toBeVisible()
  await card.addFieldButton.click()
  await expect(card.newFieldInput).toBeVisible()

  await expectScreen(visualPage)
})

test('「…」を押し、カードのメニューを開いた', { tag: ['@TC-PG-CARD-VRT4'] }, async ({ visualPage, sample }) => {
  const card = new CardViewPage(visualPage)
  await card.open(sample.project.id, sample.cards[1].id)
  await CardMenu.ofCardView(visualPage).open()

  await expectScreen(visualPage)
})

test('画像にマウスを乗せた', { tag: ['@TC-PG-CARD-VRT5'] }, async ({ visualPage, sample }) => {
  const card = new CardViewPage(visualPage)
  await card.open(sample.project.id, sample.cards[0].id)
  await card.images.first().hover({ force: true }) // 画像の上に操作ボタンの層が重なっていて、hover の判定を受け止めるため
  await expect(card.showOriginalLinks).toBeVisible()

  await expectScreen(visualPage)
})
