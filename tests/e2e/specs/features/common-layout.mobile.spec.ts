import { expect, test } from '../../fixtures'
import { ProjectScreens } from '../../pages/ProjectScreens'

test('スマホ幅では、テーブルビューのヘッダーのボタンは文言を省いてアイコンだけにする', { tag: ['@TC-FT-LAYOUT-SCR2'] }, async ({ ownerPage, project }) => {
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
