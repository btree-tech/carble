import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from '../../fixtures'
import { ProjectListPage } from '../../pages/ProjectListPage'
import { ProjectScreens } from '../../pages/ProjectScreens'
import { ProjectScreen } from '../../pages/ProjectSettingsPage'
import { IMPORT_TIMEOUT } from '../../support/imports'

test('ファイルを選んで「インポート」を押すと、ファイル名のプロジェクトを作成してインポートを始め、テーブルビューに遷移する', { tag: ['@TC-PG-PLIST-NEW9', '@TC-PG-PLIST-NEW10', '@TC-PG-PLIST-NEW11'] }, async ({ ownerPage, owner, tag }) => {
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
  // 画面を描き終える（「インポート中です」か、取り込み済みの表のどちらかが出る）まで待ってから確かめる
  await expect(importing.or(screens.tableColumnNames.first())).toBeVisible()
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

test.describe('ユーザーストーリー', () => {
  test('手元の表計算のファイル（CSV）を「ファイルをインポート」で取り込むと、ファイルの列だけを項目にしたプロジェクトができ、一覧から開いて同じデータを見られる', { tag: ['@story', '@TC-PG-PLIST-US3'] }, async ({ ownerPage, owner, tag }) => {
    // 手元の表計算で作った CSV（Excel の「CSV UTF-8」と同じ BOM 付き）
    const fileName = `採集記録${tag}.csv`
    const csv = '\ufeff種名,採集地\nヤマザクラ,高尾山\nソメイヨシノ,上野公園\n'

    const list = new ProjectListPage(ownerPage)
    await list.open()
    await list.newProjectButton.click()
    await list.importItem.click()
    await list.chooseFile({ name: fileName, mimeType: 'text/csv', buffer: Buffer.from(csv) })
    await expect(list.importDialog.getByText(fileName)).toBeVisible()
    await list.importButton.click()
    await expect(ownerPage).toHaveURL(/\/projects\/\d+$/)
    const projectId = Number(new URL(ownerPage.url()).pathname.split('/').pop())

    // 取り込みを待つ（毎分 0 秒の取り込みが終わるまで「再読み込み」で確かめる）
    const screen = new ProjectScreen(ownerPage, projectId)
    const screens = new ProjectScreens(ownerPage)
    // 画面を描き終える（「インポート中です」か、取り込み済みの表のどちらかが出る）まで待ってから確かめる
    await expect(screen.importingDialog.or(screens.tableColumnNames.first())).toBeVisible()
    await expect(async () => {
      if (await screen.importingDialog.isVisible()) await screen.reloadButton.click()
      await expect(screen.importingDialog).toBeHidden({ timeout: 1_000 })
    }).toPass({ timeout: IMPORT_TIMEOUT, intervals: [5_000] })

    // 項目はファイルの列だけで、初期の「みだし」「メモ」は無い。行はそのままカードになる
    await expect(screens.tableColumnNames).toHaveText(['並び順', 'ID', '種名', '採集地'])
    await expect(screen.cardRows).toHaveCount(2)
    for (const [i, values] of [['ヤマザクラ', '高尾山'], ['ソメイヨシノ', '上野公園']].entries()) {
      await expect(screen.values(screen.cardRows.nth(i)).nth(0)).toHaveValue(values[0])
      await expect(screen.values(screen.cardRows.nth(i)).nth(1)).toHaveValue(values[1])
    }

    // 一覧に自分のプロジェクトとして並び、「詳細」から開くと同じデータがある
    await list.open()
    await expect(list.cell(fileName, 'owner')).toHaveText(owner.name)
    await list.detailButton(fileName).click()
    await expect(ownerPage).toHaveURL(`/projects/${projectId}`)
    await expect(screens.tableColumnNames).toHaveText(['並び順', 'ID', '種名', '採集地'])
    await expect(screen.cardRows).toHaveCount(2)
    await expect(screen.values(screen.cardRows.nth(0)).nth(0)).toHaveValue('ヤマザクラ')
  })
})
