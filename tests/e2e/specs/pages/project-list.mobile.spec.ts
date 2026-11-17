import { expect, test } from '../../fixtures'
import { ProjectListPage } from '../../pages/ProjectListPage'
import { spec } from '../../support/spec'

test('スマホ幅では、最終更新日時を表示せず、「詳細」ボタンはアイコンだけにする', spec('pages/project-list.md',
  'プロジェクトの一覧 > 「プロジェクト名」「オーナー」「最終更新日時」の列と > **WHERE** スマホ幅の場合',
  'features/common-layout.md > 画面 > **WHERE** スマホ幅の場合',
), async ({ ownerPage, owner, project }) => {
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

test('スマホ幅では、「新規プロジェクト」ボタンは文言を省いてメニューを開く矢印のアイコンだけにする', spec('pages/project-list.md',
  '新規プロジェクト > 「新規プロジェクト」ボタンを表示する > **WHERE** スマホ幅の場合',
  'features/common-layout.md > 画面 > **WHERE** スマホ幅の場合',
), async ({ ownerPage }) => {
  const list = new ProjectListPage(ownerPage)
  await list.open()

  await expect(list.newProjectMenuButton).toBeVisible()
  await expect(list.newProjectMenuButton.getByText('新規プロジェクト')).toBeHidden()
  await expect(list.newProjectButton).toHaveCount(0)

  await list.newProjectMenuButton.click()
  await expect(list.layout.menuItems).toHaveText(['空白のプロジェクト', 'ファイルをインポート'])
})
