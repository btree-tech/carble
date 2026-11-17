import { expect, test } from '../../fixtures/visual'
import { ProjectSettingsPage } from '../../pages/ProjectSettingsPage'
import { createSettingsUsersScene, expectScreen, VISUAL_NAMES } from '../../support/visual'

test('オーナーの「全般」', { tag: ['@TC-PG-PSET-VRT1'] }, async ({ visualPage, sample }) => {
  const settings = new ProjectSettingsPage(visualPage, sample.project.id)
  await settings.open('全般')
  await expect(settings.tabs).toHaveCount(4)

  await expectScreen(visualPage)
})

test('オーナー以外の「全般」', { tag: ['@TC-PG-PSET-VRT2'] }, async ({ visualApi, sample, newAccount, apiAs, pageAs }) => {
  const editor = await newAccount({ suffix: 'editor', name: VISUAL_NAMES.editor })
  await visualApi.invite(sample.project.id, editor.username!)
  await (await apiAs(editor)).accept(sample.project.id, editor.id)

  const settings = new ProjectSettingsPage(await pageAs(editor), sample.project.id)
  await settings.open('全般')
  await expect(settings.tabs).toHaveCount(1)

  await expectScreen(settings.page)
})

test('「インポート」（インポートの履歴が無い）', { tag: ['@TC-PG-PSET-VRT3'] }, async ({ visualPage, sample }) => {
  const settings = new ProjectSettingsPage(visualPage, sample.project.id)
  await settings.open('インポート')
  await expect(settings.historyTable.getByText('No items.')).toBeVisible()

  await expectScreen(visualPage)
})

test('「同じIDのカードを上書きする」をチェックし、ダイアログを表示した', { tag: ['@TC-PG-PSET-VRT4'] }, async ({ visualPage, sample }) => {
  const settings = new ProjectSettingsPage(visualPage, sample.project.id)
  await settings.open('インポート')
  await settings.updateCheckbox.check()
  await expect(settings.okButton).toBeVisible()

  await expectScreen(visualPage)
})

test('「ユーザー管理」（オーナー・編集者・招待中のユーザーがいる）', { tag: ['@TC-PG-PSET-VRT5'] }, async ({ visualPage, visualApi, sample, newAccount, apiAs }) => {
  await createSettingsUsersScene(visualApi, sample.project.id, newAccount, apiAs)
  const settings = new ProjectSettingsPage(visualPage, sample.project.id)
  await settings.open('ユーザー管理')
  await expect(settings.userRows).toHaveCount(3)

  // ユーザーID はテストごとに変わるので塗る
  await expectScreen(visualPage, { mask: [settings.userRows.locator('td:first-child')] })
})

test('「プロジェクト削除」', { tag: ['@TC-PG-PSET-VRT7'] }, async ({ visualPage, sample }) => {
  const settings = new ProjectSettingsPage(visualPage, sample.project.id)
  await settings.open('プロジェクト削除')
  await expect(settings.deleteProjectButton).toBeVisible()

  await expectScreen(visualPage)
})
