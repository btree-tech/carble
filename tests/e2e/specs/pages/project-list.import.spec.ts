import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from '../../fixtures'
import { ProjectListPage } from '../../pages/ProjectListPage'
import { ProjectScreens } from '../../pages/ProjectScreens'
import { IMPORT_TIMEOUT } from '../../support/imports'
import { spec } from '../../support/spec'

test('ファイルを選んで「インポート」を押すと、ファイル名のプロジェクトを作成してインポートを始め、テーブルビューに遷移する', spec('pages/project-list.md',
  '新規プロジェクト > **WHEN** 「ファイルをインポート」を選ぶと > **WHEN** ファイルを選んで「インポート」を押すと',
  '新規プロジェクト > **WHEN** 「ファイルをインポート」を選ぶと > **WHEN** ファイルを選んで「インポート」を押すと > 作成したユーザーがオーナーになる',
  '新規プロジェクト > **WHEN** 「ファイルをインポート」を選ぶと > **WHEN** ファイルを選んで「インポート」を押すと > 項目は作成しない',
), async ({ ownerPage, owner, tag }) => {
  const fileName = `取り込み${tag}.csv`
  const list = new ProjectListPage(ownerPage)
  await list.open()
  await list.newProjectButton.click()
  await list.importItem.click()
  // 列名は英字にする（BOM の無い UTF-8 の CSV は、日本語の列名が文字化けして取り込まれる。この画面の仕様ではないので報告に回した）
  await list.chooseFile({
    name: fileName,
    mimeType: 'text/csv',
    buffer: readFileSync(fileURLToPath(new URL('../../files/auth/import.csv', import.meta.url))),
  })
  await expect(list.importDialog.getByText(fileName)).toBeVisible()

  await list.importButton.click()

  await expect(ownerPage).toHaveURL(/\/projects\/\d+$/)
  const projectId = Number(new URL(ownerPage.url()).pathname.split('/').pop())
  const screens = new ProjectScreens(ownerPage)
  const importing = ownerPage.getByText('インポート中です')
  // 取り込みを待っている間は「インポート中です」を表示する。毎分 0 秒の取り込みが終わるまで「再読み込み」で確かめる
  await expect(async () => {
    if (await importing.isVisible()) await ownerPage.getByRole('button', { name: '再読み込み' }).click()
    await expect(importing).toBeHidden({ timeout: 1_000 })
  }).toPass({ timeout: IMPORT_TIMEOUT, intervals: [5_000] })

  // 項目は初期の「みだし」「メモ」を作らず、ファイルの列から作る
  await expect(screens.tableColumnNames).toHaveText(['並び順', 'ID', 'title', 'note'])
  await expect(screens.projectNameInput).toHaveValue(fileName)

  // 作成したユーザーがオーナー
  await list.open()
  await expect(list.cell(fileName, 'owner')).toHaveText(owner.name)
  await screens.open(ProjectScreens.paths(projectId).settingsUsers)
  await expect(screens.userCell(owner.username!, 'role')).toHaveText('管理者')
})
