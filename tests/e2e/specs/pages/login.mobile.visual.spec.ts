import { test } from '../../fixtures'
import { LoginPage } from '../../pages/LoginPage'
import { expectScreen } from '../../support/visual'

test('ログイン画面', { tag: ['@TC-PG-LOGIN-VRT2'] }, async ({ pageAs }) => {
  const login = new LoginPage(await pageAs('guest'))
  await login.open()

  await expectScreen(login.page)
})
