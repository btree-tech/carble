import { expect, test } from '../../fixtures'
import { TableViewPage } from '../../pages/TableViewPage'
import { spec } from '../../support/spec'

const SPEC = 'pages/table-view.md'

test('スマホ幅では「ホーム」「グリッドビュー」「カード印刷ビュー」「プロジェクト設定」「カード入力」「追加」の文言を省いてアイコンだけにする', spec(SPEC,
  'ヘッダー > WHERE スマホ幅の場合',
), async ({ ownerPage, ownerApi, project }) => {
  await ownerApi.addCard(project.id, { みだし: 'a' })
  const tv = new TableViewPage(ownerPage)
  await tv.open(project.id)

  const iconOnly = [
    [tv.homeLink, 'ホーム'],
    [tv.gridViewLink, 'グリッドビュー'],
    [tv.printViewLink, 'カード印刷ビュー'],
    [tv.settingsLink, 'プロジェクト設定'],
    [tv.cardInputLink(1), 'カード入力'],
    [tv.addButton, '追加'],
  ] as const
  for (const [button, label] of iconOnly) {
    await expect(button).toBeVisible()
    await expect(button.getByText(label, { exact: true })).toBeHidden()
  }
})

test('スマホ幅では件数を表示しない', spec(SPEC,
  'カードの一覧 > カードの件数を「全 N 件」と表示する > WHERE スマホ幅の場合',
), async ({ ownerPage, ownerApi, project }) => {
  await ownerApi.addCard(project.id, { みだし: 'apple' })
  await ownerApi.addCard(project.id, { みだし: 'banana' })
  const tv = new TableViewPage(ownerPage)
  await tv.open(project.id)
  await expect(tv.searchInput).toBeVisible()
  await expect(tv.countText).toBeHidden()

  await tv.search('apple')
  await expect(tv.idCells).toHaveText(['1'])
  await expect(tv.countText).toBeHidden()
})
