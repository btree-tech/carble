import { expect, test } from '../../fixtures'
import { ProjectListPage } from '../../pages/ProjectListPage'
import { createProjectListScene, expectScreen, VISUAL_NAMES } from '../../support/visual'

test('メンバーになっているプロジェクトと、招待されているプロジェクトがある', { tag: ['@TC-PG-PLIST-VRT2'] }, async ({ newAccount, apiAs, pageAs }) => {
  const owner = await newAccount({ suffix: 'owner', name: VISUAL_NAMES.owner })
  const me = await newAccount({ suffix: 'me', name: VISUAL_NAMES.editor })
  await createProjectListScene(await apiAs(me), me.id, me.username!, await apiAs(owner))

  const list = new ProjectListPage(await pageAs(me))
  await list.open()
  await expect(list.rows).toHaveCount(2)

  // スマホ幅は最終更新日時を表示しない
  await expectScreen(list.page)
})
