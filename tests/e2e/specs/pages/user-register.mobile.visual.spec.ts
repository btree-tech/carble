import { test } from '../../fixtures'
import { UserFormPage } from '../../pages/UserFormPage'
import { expectScreen, VISUAL_NAMES } from '../../support/visual'

test('初めてログインした（ユーザーID は空、名前は Google アカウントの名前）', { tag: ['@TC-PG-REGISTER-VRT3'] }, async ({ newAccount, pageAs }) => {
  const form = new UserFormPage(await pageAs(await newAccount({ username: null, name: VISUAL_NAMES.owner })))
  await form.openNew()

  await expectScreen(form.page)
})
