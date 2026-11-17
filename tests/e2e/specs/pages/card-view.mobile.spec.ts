import { expect, test } from '../../fixtures'
import { addImageByApi, CardViewPage } from '../../pages/CardViewPage'
import { spec } from '../../support/spec'

test('画面が縦長の場合、画像を項目の下に表示する', spec('pages/card-view.md',
  'カードの内容 > 項目と画像を左右に並べて表示する > WHERE 画面が縦長の場合',
), async ({ ownerPage, ownerApi, project }) => {
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
