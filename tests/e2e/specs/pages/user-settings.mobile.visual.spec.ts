import { test } from '../../fixtures'
import { UserFormPage } from '../../pages/UserFormPage'
import { expectScreen, VISUAL_NAMES } from '../../support/visual'

// ユーザーID はテストごとに変わる（リポジトリ全体で重ならない値）ので塗る
test('今のユーザーIDと名前が入っている', { tag: ['@TC-PG-USERSET-VRT2'] }, async ({ newAccount, pageAs }) => {
  const form = new UserFormPage(await pageAs(await newAccount({ name: VISUAL_NAMES.owner })))
  await form.openEdit()

  await expectScreen(form.page, { mask: [form.username] })
})
