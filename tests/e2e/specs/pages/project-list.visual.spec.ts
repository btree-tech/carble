import { expect, test } from '../../fixtures'
import { ProjectListPage } from '../../pages/ProjectListPage'
import { createProjectListScene, expectScreen, VISUAL_NAMES } from '../../support/visual'

test('メンバーになっているプロジェクトと、招待されているプロジェクトがある', { tag: ['@TC-PG-PLIST-VRT1'] }, async ({ newAccount, apiAs, pageAs }) => {
  const owner = await newAccount({ suffix: 'owner', name: VISUAL_NAMES.owner })
  const me = await newAccount({ suffix: 'me', name: VISUAL_NAMES.editor })
  await createProjectListScene(await apiAs(me), me.id, me.username!, await apiAs(owner))

  const list = new ProjectListPage(await pageAs(me))
  await list.open()
  await expect(list.rows).toHaveCount(2)

  // 最終更新日時は実行ごとに変わるので塗る
  await expectScreen(list.page, { mask: [list.rows.locator('td:nth-child(4)')] })
})

test('メンバーになっているプロジェクトが無い', { tag: ['@TC-PG-PLIST-VRT3'] }, async ({ newAccount, pageAs }) => {
  const list = new ProjectListPage(await pageAs(await newAccount({ name: VISUAL_NAMES.owner })))
  await list.open()
  await expect(list.emptyMessage).toBeVisible()

  await expectScreen(list.page)
})

test('名前のボタンを押し、「設定」「ログアウト」のメニューを開いた', { tag: ['@TC-PG-PLIST-VRT4'] }, async ({ newAccount, pageAs }) => {
  const list = new ProjectListPage(await pageAs(await newAccount({ name: VISUAL_NAMES.owner })))
  await list.open()
  await list.layout.userMenuButton(VISUAL_NAMES.owner).click()
  await expect(list.layout.menuItems).toHaveText(['設定', 'ログアウト'])

  await expectScreen(list.page)
})

test('「新規プロジェクト」を押し、「空白のプロジェクト」「ファイルをインポート」のメニューを開いた', { tag: ['@TC-PG-PLIST-VRT5'] }, async ({ newAccount, pageAs }) => {
  const list = new ProjectListPage(await pageAs(await newAccount({ name: VISUAL_NAMES.owner })))
  await list.open()
  await list.newProjectButton.click()
  await expect(list.importItem).toBeVisible()

  await expectScreen(list.page)
})

test('「ファイルをインポート」を選び、「インポート」のダイアログを開いた', { tag: ['@TC-PG-PLIST-VRT6'] }, async ({ newAccount, pageAs }) => {
  const list = new ProjectListPage(await pageAs(await newAccount({ name: VISUAL_NAMES.owner })))
  await list.open()
  await list.newProjectButton.click()
  await list.importItem.click()
  await expect(list.importButton).toBeVisible()

  await expectScreen(list.page)
})
