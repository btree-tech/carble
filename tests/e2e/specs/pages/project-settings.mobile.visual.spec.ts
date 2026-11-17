import { expect, test } from '../../fixtures/visual'
import { ProjectSettingsPage } from '../../pages/ProjectSettingsPage'
import { createSettingsUsersScene, expectScreen } from '../../support/visual'

test('「ユーザー管理」（オーナー・編集者・招待中のユーザーがいる）', { tag: ['@TC-PG-PSET-VRT6'] }, async ({ visualPage, visualApi, sample, newAccount, apiAs }) => {
  await createSettingsUsersScene(visualApi, sample.project.id, newAccount, apiAs)
  const settings = new ProjectSettingsPage(visualPage, sample.project.id)
  await settings.open('ユーザー管理')
  await expect(settings.userRows).toHaveCount(3)

  // ユーザーID はテストごとに変わるので塗る
  await expectScreen(visualPage, { mask: [settings.userRows.locator('td:first-child')] })
})
