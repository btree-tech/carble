import { expect, test } from '../../fixtures'
import { UserFormPage } from '../../pages/UserFormPage'
import { expectScreen, VISUAL_NAMES } from '../../support/visual'

test('初めてログインした（ユーザーID は空、名前は Google アカウントの名前）', { tag: ['@TC-PG-REGISTER-VRT1'] }, async ({ newAccount, pageAs }) => {
  const form = new UserFormPage(await pageAs(await newAccount({ username: null, name: VISUAL_NAMES.owner })))
  await form.openNew()

  await expectScreen(form.page)
})

test('入力に問題がある（ユーザーID が 3 文字未満、名前が空）', { tag: ['@TC-PG-REGISTER-VRT2'] }, async ({ newAccount, pageAs }) => {
  const form = new UserFormPage(await pageAs(await newAccount({ username: null, name: VISUAL_NAMES.owner })))
  await form.openNew()
  await form.fillUsername('ab')
  await form.name.fill('')
  await expect(form.message('3文字以上30文字以下で設定してください')).toBeVisible()
  await expect(form.message('必須です')).toBeVisible()
  await expect(form.saveButton).toBeDisabled()

  await expectScreen(form.page)
})
