import { expect, test } from '../../fixtures'
import { ProjectListPage } from '../../pages/ProjectListPage'

test('スマホ幅では、最終更新日時を表示せず、「詳細」ボタンはアイコンだけにする', { tag: ['@TC-PG-PLIST-LIST6', '@TC-FT-LAYOUT-SCR2'] }, async ({ ownerPage, owner, project }) => {
  const list = new ProjectListPage(ownerPage)
  await list.open()

  await expect(list.columnHeader('プロジェクト名')).toBeVisible()
  await expect(list.columnHeader('オーナー')).toBeVisible()
  await expect(list.columnHeader('最終更新日時')).toBeHidden()
  await expect(list.cell(project.name, 'owner')).toHaveText(owner.name)
  await expect(list.cell(project.name, 'updatedAt')).toBeHidden()

  // 「詳細」はアイコンだけ（文言を表示しない）で、押すとテーブルビューに遷移する
  await expect(list.detailButton(project.name)).toBeVisible()
  await expect(list.detailButton(project.name)).toHaveAccessibleName('')
  await expect(list.detailButton(project.name).getByText('詳細')).toBeHidden()
  await list.detailButton(project.name).click()
  await expect(ownerPage).toHaveURL(`/projects/${project.id}`)
})

test('スマホ幅では、「新規プロジェクト」ボタンは文言を省いてメニューを開く矢印のアイコンだけにする', { tag: ['@TC-PG-PLIST-NEW2', '@TC-FT-LAYOUT-SCR2'] }, async ({ ownerPage }) => {
  const list = new ProjectListPage(ownerPage)
  await list.open()

  await expect(list.newProjectMenuButton).toBeVisible()
  await expect(list.newProjectMenuButton.getByText('新規プロジェクト')).toBeHidden()
  await expect(list.newProjectButton).toHaveCount(0)

  await list.newProjectMenuButton.click()
  await expect(list.layout.menuItems).toHaveText(['空白のプロジェクト', 'ファイルをインポート'])
})
