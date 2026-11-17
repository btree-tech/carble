import { expect, test } from '../../fixtures'
import { LoginPage } from '../../pages/LoginPage'
import { ProjectListPage } from '../../pages/ProjectListPage'
import { UserFormPage } from '../../pages/UserFormPage'
import { spec } from '../../support/spec'

test('ロゴと「Googleでログイン」ボタンを表示する', spec('pages/login.md',
  'ロゴと「Googleでログイン」ボタンを表示する',
), async ({ pageAs }) => {
  const login = new LoginPage(await pageAs('guest'))
  await login.open()

  await expect(login.logo).toBeVisible()
  await expect(login.googleButton).toBeVisible()
})

test('「Googleでログイン」を押すと、Google のログイン画面に遷移する', spec('pages/login.md',
  '**WHEN** 「Googleでログイン」を押すと',
), async ({ pageAs }) => {
  const login = new LoginPage(await pageAs('guest'))
  await login.open()

  // Google の画面そのものは通らない。Google のログイン画面への遷移が始まったところまでを確かめる
  const { signIn, google } = await login.signInWithGoogle()

  expect(signIn.method()).toBe('POST')
  expect(JSON.parse(signIn.postData() ?? '{}')).toMatchObject({ provider: 'google' })
  const url = new URL(google.url())
  expect(url.origin).toBe('https://accounts.google.com')
  expect(url.searchParams.get('redirect_uri')).toBe(`${process.env.BASE_URL}/api/auth/callback/google`)
  expect(google.isNavigationRequest()).toBe(true)
})

test('初めてログインすると、ユーザー登録に遷移する', spec('pages/login.md',
  '**WHEN** 「Googleでログイン」を押すと > **WHEN** 初めてログインすると',
), async ({ pageAs, newAccount }) => {
  // Google から戻る先として、初めてのユーザーにはユーザー登録を指定している
  const login = new LoginPage(await pageAs('guest'))
  await login.open()
  const { signIn } = await login.signInWithGoogle()
  expect(JSON.parse(signIn.postData() ?? '{}')).toMatchObject({ newUserCallbackURL: '/users/new' })

  // 初めてログインした直後（ユーザーID 未登録）の状態で、戻り先を開くとユーザー登録を表示する
  const account = await newAccount({ username: null })
  const page = await pageAs(account)
  const form = new UserFormPage(page)
  await form.openNew()
  await expect(page).toHaveURL('/users/new')
  await expect(form.username).toBeVisible()
})

test('登録済みのユーザーがログインすると、プロジェクト一覧に遷移する', spec('pages/login.md',
  '**WHEN** 「Googleでログイン」を押すと > **WHEN** 登録済みのユーザーがログインすると',
), async ({ pageAs, owner, project }) => {
  const login = new LoginPage(await pageAs('guest'))
  await login.open()
  const { signIn } = await login.signInWithGoogle()
  expect(JSON.parse(signIn.postData() ?? '{}')).toMatchObject({ callbackURL: '/' })

  // ログインした後の状態で、戻り先（/）を開くとプロジェクト一覧を表示する
  const list = new ProjectListPage(await pageAs(owner))
  await list.open()
  await expect(list.page).toHaveURL('/')
  await expect(list.row(project.name)).toBeVisible()
})

test('ユーザーIDを登録していないユーザーがログインすると、ユーザー登録に遷移する', spec('pages/login.md',
  '**WHEN** 「Googleでログイン」を押すと > **WHEN** 登録済みのユーザーがログインすると > **WHERE** ユーザーID をまだ登録していない場合',
  'features/roles.md > ログイン > **WHERE** ログインしているがユーザーIDを登録していない場合',
), async ({ pageAs, newAccount }) => {
  // ログインした後の戻り先（/）を、ユーザーID 未登録のユーザーで開く
  const page = await pageAs(await newAccount({ username: null }))
  await page.goto('/')

  await expect(page).toHaveURL('/users/new')
  await expect(new UserFormPage(page).username).toBeVisible()
})

test('ログインしている場合も、ログイン画面を表示する', spec('pages/login.md',
  '**WHERE** ログインしている場合も',
), async ({ ownerPage }) => {
  const login = new LoginPage(ownerPage)
  await login.open()

  await expect(ownerPage).toHaveURL('/login')
  await expect(login.googleButton).toBeVisible()
})

test('ユーザーメニューで「ログアウト」を選ぶと、ログアウトしてログイン画面に戻る', spec('pages/login.md',
  '**WHEN** プロジェクト一覧のユーザーメニューで「ログアウト」を選ぶと',
  'pages/project-list.md > ヘッダー > **WHEN** 名前のボタンを押すと > **WHEN** 「ログアウト」を選ぶと',
), async ({ ownerPage, owner }) => {
  const list = new ProjectListPage(ownerPage)
  await list.open()

  await list.layout.chooseUserMenu(owner.name, 'ログアウト')

  await expect(ownerPage).toHaveURL('/login')
  await expect(new LoginPage(ownerPage).googleButton).toBeVisible()
  // ログアウトしたので、プロジェクト一覧を開くとログイン画面に戻る
  await ownerPage.goto('/')
  await expect(ownerPage).toHaveURL('/login')
})
