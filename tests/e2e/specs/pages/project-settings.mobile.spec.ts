import { expect, test } from '../../fixtures'
import { fileOf, MIME, ProjectSettingsPage, uploadImport } from '../../pages/ProjectSettingsPage'
import { knownIssue, spec, withIssue } from '../../support/spec'

test('スマホ幅では、「テーブルビュー」ボタンを文言なしのアイコンだけにする', spec('pages/project-settings.md',
  'ヘッダー > プロジェクト名、「テーブルビュー」ボタン、タブを表示する > WHERE スマホ幅の場合',
), async ({ ownerPage, project }) => {
  const settings = new ProjectSettingsPage(ownerPage, project.id)
  await settings.open()

  await expect(settings.tableViewButton).toBeVisible()
  await expect(settings.tableViewLabel).toBeHidden()

  await settings.tableViewButton.click()
  await expect(ownerPage).toHaveURL(`/projects/${project.id}`)
})

test('【実装との乖離】スマホ幅では、インポート履歴の「結果」の見出しは表示しないが、各行の結果は表示する（あるべき: 「結果」の列を表示しない）', withIssue(
  spec('pages/project-settings.md', 'インポート > 「インポート履歴」に > WHERE スマホ幅の場合、「結果」を表示しない'),
  // 列の class（hidden md:table-cell）は Nuxt UI の UTable では見出しのセルにしか付かない
  knownIssue('pages/project-settings.md', 'スマホ幅では、インポート履歴の「結果」の見出しは表示しないが、各行の結果は表示する'),
), async ({ ownerPage, owner, ownerApi, project, tag }) => {
  const settings = new ProjectSettingsPage(ownerPage, project.id)
  // インポートを待っている間はプロジェクトの画面を開けないので、先に開いておき、画面の中の遷移で読み直す
  await settings.open('インポート')
  const name = `${tag}.csv`
  try {
    await uploadImport(owner, project.id, { ...await fileOf('header-only.csv', MIME.csv), name })
    await settings.reloadHistory()

    const row = settings.historyRow(name)
    await expect(settings.historyCell(row, 'ファイル名')).toBeVisible()
    await expect(settings.historyCell(row, 'インポート日時')).toBeVisible()
    await expect(settings.historyTable.getByRole('columnheader', { name: 'ファイル名' })).toBeVisible()
    // 「結果」の見出しは表示しないが、行の結果（未処理）は表示している
    const result = ownerPage.getByRole('columnheader', { name: '結果', includeHidden: true })
    await expect(result).toHaveCount(1)
    await expect(result).toBeHidden()
    await expect(row.getByText('未処理')).toBeVisible()
  } finally {
    // 待っているインポートを残すと、全体の取り込みの順番を待たせるので、プロジェクトごと消す
    await ownerApi.call('delete', `/api/projects/${project.id}`)
  }
})

test('スマホ幅では、ユーザー管理の「削除」ボタンを文言なしのアイコンだけにする', spec('pages/project-settings.md',
  'ユーザー管理 > プロジェクトのユーザーを > WHERE オーナー以外の行の場合 > WHERE スマホ幅の場合',
), async ({ ownerPage, ownerApi, project, newAccount }) => {
  const invited = await newAccount({ suffix: 'invited' })
  await ownerApi.invite(project.id, invited.username!)
  const settings = new ProjectSettingsPage(ownerPage, project.id)
  await settings.open('ユーザー管理')

  const button = settings.userRow(invited.username!).getByRole('button')
  await expect(button).toBeVisible()
  await expect(button.getByText('削除')).toBeHidden()

  ownerPage.once('dialog', (dialog) => void dialog.accept())
  await button.click()
  await expect(settings.userRow(invited.username!)).toHaveCount(0)
})
