import { expect, test } from '../../fixtures'
import { ProjectScreens } from '../../pages/ProjectScreens'
import { spec } from '../../support/spec'

test('スマホ幅では、テーブルビューのヘッダーのボタンは文言を省いてアイコンだけにする', spec('features/common-layout.md',
  '画面 > **WHERE** スマホ幅の場合',
), async ({ ownerPage, project }) => {
  const screens = new ProjectScreens(ownerPage)
  const paths = ProjectScreens.paths(project.id)
  await screens.open(paths.table)

  for (const [path, label] of [
    ['/', 'ホーム'],
    [paths.grid, 'グリッドビュー'],
    [paths.print, 'カード印刷ビュー'],
    [paths.settings, 'プロジェクト設定'],
  ]) {
    const link = screens.linkTo(path)
    await expect(link, label).toBeVisible()
    await expect(link.getByText(label), label).toBeHidden()
  }
  await expect(screens.addCardButton).toHaveCount(0)

  // アイコンだけのボタンでも、押すとその画面に遷移する
  await screens.linkTo(paths.settings).click()
  await expect(ownerPage).toHaveURL(paths.settings)
})
