import { expect, test } from '../../fixtures'
import { Layout } from '../../pages/components/Layout'
import { ProjectListPage } from '../../pages/ProjectListPage'
import { UserFormPage } from '../../pages/UserFormPage'
import { knownIssue, spec, withIssue } from '../../support/spec'

test.describe('初めてログインしたユーザー（ユーザーID 未登録）', () => {
  test('「ユーザーID」「名前」の入力欄と「保存」ボタンを表示し、ほかの画面へのリンクは表示しない', spec('pages/user-register.md',
    '「ユーザーID」と「名前」の入力欄と、「保存」ボタンを表示する',
    '「ユーザーID」と「名前」の入力欄と、「保存」ボタンを表示する > ほかの画面へのリンク',
  ), async ({ pageAs, newAccount }) => {
    const form = new UserFormPage(await pageAs(await newAccount({ username: null })))
    await form.openNew()

    await expect(form.username).toBeVisible()
    await expect(form.name).toBeVisible()
    await expect(form.saveButton).toBeVisible()
    await expect(form.links).toHaveCount(0)
  })

  test('ユーザーID は空、名前は Google アカウントの名前で、空のユーザーID には「carble」を薄く表示する', spec('pages/user-register.md',
    '入力欄の初期値は > 初めてログインしたときは',
    '入力欄の初期値は > ユーザーID の入力欄が空のときは',
  ), async ({ pageAs, newAccount, tag }) => {
    const account = await newAccount({ username: null, name: `Google の名前${tag}` })
    const form = new UserFormPage(await pageAs(account))
    await form.openNew()

    await expect(form.name).toHaveValue(`Google の名前${tag}`)
    await expect(form.username).toHaveValue('')
    await expect(form.username).toHaveAttribute('placeholder', 'carble')
  })

  test('ユーザーID の入力欄に利用可能な文字を案内する', spec('pages/user-register.md',
    'ユーザーID の入力欄に「利用可能な文字',
  ), async ({ pageAs, newAccount }) => {
    const form = new UserFormPage(await pageAs(await newAccount({ username: null })))
    await form.openNew()

    await expect(form.usernameHelp).toBeVisible()
  })

  test('ユーザーID が 3 文字未満・30 文字を超えると「3文字以上30文字以下で設定してください」と表示し、保存できない', spec('pages/user-register.md',
    'ユーザーID は入力するたびに確かめ > **IF** 3 文字未満または 30 文字を超える場合',
    '**WHILE** 入力に問題がある間は',
  ), async ({ pageAs, newAccount }) => {
    const form = new UserFormPage(await pageAs(await newAccount({ username: null })))
    await form.openNew()
    const message = form.message('3文字以上30文字以下で設定してください')

    await form.fillUsername('ab')
    await expect(message).toBeVisible()
    await expect(form.saveButton).toBeDisabled()

    await form.fillUsername('abc')
    await expect(message).toBeHidden()
    await expect(form.saveButton).toBeEnabled()

    await form.fillUsername('a'.repeat(31))
    await expect(message).toBeVisible()
    await expect(form.saveButton).toBeDisabled()

    await form.fillUsername('a'.repeat(30))
    await expect(message).toBeHidden()
    await expect(form.saveButton).toBeEnabled()
  })

  test('ユーザーID に半角英数・ハイフン・アンダースコア以外の文字を含むと「利用できない文字が含まれています」と表示する', spec('pages/user-register.md',
    'ユーザーID は入力するたびに確かめ > **IF** 半角英数・ハイフン・アンダースコア以外',
    '**WHILE** 入力に問題がある間は',
  ), async ({ pageAs, newAccount, tag }) => {
    const form = new UserFormPage(await pageAs(await newAccount({ username: null })))
    await form.openNew()
    const message = form.message('利用できない文字が含まれています')

    for (const value of [`${tag}.x`, `${tag} x`, `${tag}あ`, `${tag}@`]) {
      await form.fillUsername(value)
      await expect(message, value).toBeVisible()
      await expect(form.saveButton).toBeDisabled()
    }

    await form.fillUsername(`${tag}-A_9`)
    await expect(message).toBeHidden()
    await expect(form.saveButton).toBeEnabled()
  })

  test('他のユーザーが使っているユーザーID は「既に使われています」と表示し、大文字と小文字は区別しない', spec('pages/user-register.md',
    'ユーザーID は入力するたびに確かめ > **IF** 他のユーザーが使っているユーザーID の場合',
    'ユーザーID は入力するたびに確かめ > **IF** 他のユーザーが使っているユーザーID の場合 > 英字の大文字と小文字は区別しない',
    '**WHILE** 入力に問題がある間は',
  ), async ({ pageAs, newAccount }) => {
    const other = await newAccount({ suffix: 'other' })
    const form = new UserFormPage(await pageAs(await newAccount({ username: null })))
    await form.openNew()
    const message = form.message('既に使われています')

    await form.fillUsername(other.username!)
    await expect(message).toBeVisible()
    await expect(form.saveButton).toBeDisabled()

    await form.fillUsername(`${other.username}x`)
    await expect(message).toBeHidden()
    await expect(form.saveButton).toBeEnabled()

    await form.fillUsername(other.username!.toUpperCase())
    await expect(message).toBeVisible()
    await expect(form.saveButton).toBeDisabled()
  })

  test('他のユーザーが使っているかを確かめている間は、入力欄に読み込み中のアイコンを表示する', spec('pages/user-register.md',
    'ユーザーID は入力するたびに確かめ > **WHILE** 他のユーザーが使っているかを確かめている間は',
  ), async ({ pageAs, newAccount, tag }) => {
    const page = await pageAs(await newAccount({ username: null }))
    const form = new UserFormPage(page)
    await form.openNew()
    const seen = await new Layout(page).watchSpinner(UserFormPage.USERNAME_LOADING)

    const checked = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/auth/is-username-available')
    await form.fillUsername(`${tag}free`)
    await checked

    // 確かめている間に表示し、確かめ終わると消える
    expect(await seen()).toBe(true)
    await expect(page.locator(UserFormPage.USERNAME_LOADING)).toBeHidden()
  })

  test('名前が空だと「必須です」と表示し、保存できない', spec('pages/user-register.md',
    '**IF** 名前が空の場合',
    '**WHILE** 入力に問題がある間は',
  ), async ({ pageAs, newAccount, tag }) => {
    const form = new UserFormPage(await pageAs(await newAccount({ username: null })))
    await form.openNew()
    await form.fillUsername(`${tag}new`)
    await expect(form.saveButton).toBeEnabled()

    await form.name.fill('')

    await expect(form.message('必須です')).toBeVisible()
    await expect(form.saveButton).toBeDisabled()
  })

  test('「保存」を押すと、ユーザーIDを小文字にして名前とともに保存し、プロジェクト一覧に遷移する', spec('pages/user-register.md',
    '**WHEN** 「保存」を押すと',
    '**WHEN** 「保存」を押すと > ユーザーID の英字の大文字は',
  ), async ({ pageAs, newAccount, tag }) => {
    const page = await pageAs(await newAccount({ username: null }))
    const form = new UserFormPage(page)
    await form.openNew()

    await form.fillUsername(`${tag.toUpperCase()}-New`)
    await form.name.fill(`登録した名前${tag}`)
    await expect(form.saveButton).toBeEnabled()
    await form.save()

    await expect(page).toHaveURL('/')
    const list = new ProjectListPage(page)
    await expect(list.layout.userMenuButton(`登録した名前${tag}`)).toBeVisible()

    // 保存したユーザーIDは小文字になっている
    await form.openEdit()
    await expect(form.username).toHaveValue(`${tag.toLowerCase()}-new`)
    await expect(form.name).toHaveValue(`登録した名前${tag}`)
  })

  test('【既知の問題】ユーザーID に触れずに「保存」を押せ、メッセージも出ずにこの画面に戻される（あるべき: ユーザーID が空のままでは保存できない）', withIssue(
    spec('pages/user-register.md', '**WHILE** 入力に問題がある間は'),
    knownIssue('docs/ISSUES.md', '初回のユーザー登録でユーザーIDを入れずに保存できる'),
  ), async ({ pageAs, newAccount }) => {
    const page = await pageAs(await newAccount({ username: null }))
    const form = new UserFormPage(page)
    await form.openNew()

    await expect(form.saveButton).toBeEnabled()
    const response = await form.save()
    expect(response.ok()).toBe(true)

    // プロジェクト一覧に遷移しようとして、ユーザーID が無いのでこの画面に戻される
    await expect(page).toHaveURL('/users/new')
    await expect(form.username).toHaveValue('')
    for (const message of ['必須です', '3文字以上30文字以下で設定してください']) {
      await expect(form.message(message)).toBeHidden()
    }
  })
})

test('登録済みのユーザーが開くと、入力欄の初期値は今のユーザーIDと名前とする', spec('pages/user-register.md',
  '入力欄の初期値は',
), async ({ ownerPage, owner }) => {
  const form = new UserFormPage(ownerPage)
  await form.openNew()

  await expect(form.username).toHaveValue(owner.username!)
  await expect(form.name).toHaveValue(owner.name)
})
