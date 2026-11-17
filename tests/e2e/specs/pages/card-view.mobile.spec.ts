import { expect, test } from '../../fixtures'
import { addImageByApi, CardViewPage } from '../../pages/CardViewPage'

test('画面が縦長の場合、画像を項目の下に表示する', { tag: ['@TC-PG-CARD-VAL2'] }, async ({ ownerPage, ownerApi, project }) => {
  const card = await ownerApi.addCard(project.id)
  await addImageByApi(ownerPage, project.id, card.id)
  const view = new CardViewPage(ownerPage)
  await view.open(project.id, card.id)

  const field = (await view.field('メモ').boundingBox())!
  const image = (await view.images.first().boundingBox())!
  const addImage = (await view.addImageButton.boundingBox())!
  expect(image.y).toBeGreaterThanOrEqual(field.y + field.height)
  expect(addImage.y).toBeGreaterThan(image.y)
})
