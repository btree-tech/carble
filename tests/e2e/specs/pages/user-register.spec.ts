import { expect, test } from '../../fixtures'
import { Layout } from '../../pages/components/Layout'
import { ProjectListPage } from '../../pages/ProjectListPage'
import { ProjectSettingsPage } from '../../pages/ProjectSettingsPage'
import { UserFormPage } from '../../pages/UserFormPage'
import { knownIssue } from '../../support/spec'

test.describe('初めてログインしたユーザー（ユーザーID 未登録）', () => {
  test('「ユーザーID」「名前」の入力欄と「保存」ボタンを表示し、ほかの画面へのリンクは表示しない', { tag: ['@TC-PG-REGISTER-GEN1', '@TC-PG-REGISTER-GEN2'] }, async ({ pageAs, newAccount }) => {
    const form = new UserFormPage(await pageAs(await newAccount({ username: null })))
    await form.openNew()

    await expect(form.username).toBeVisible()
    await expect(form.name).toBeVisible()
    await expect(form.saveButton).toBeVisible()
    await expect(form.links).toHaveCount(0)
  })

  test('ユーザーID は空、名前は Google アカウントの名前で、空のユーザーID には「carble」を薄く表示する', { tag: ['@TC-PG-REGISTER-GEN4', '@TC-PG-REGISTER-GEN5'] }, async ({ pageAs, newAccount, tag }) => {
    const account = await newAccount({ username: null, name: `Google の名前${tag}` })
    const form = new UserFormPage(await pageAs(account))
    await form.openNew()

    await expect(form.name).toHaveValue(`Google の名前${tag}`)
    await expect(form.username).toHaveValue('')
    await expect(form.username).toHaveAttribute('placeholder', 'carble')
  })

  test('ユーザーID の入力欄に利用可能な文字を案内する', { tag: ['@TC-PG-REGISTER-GEN6'] }, async ({ pageAs, newAccount }) => {
    const form = new UserFormPage(await pageAs(await newAccount({ username: null })))
    await form.openNew()

    await expect(form.usernameHelp).toBeVisible()
  })

  test('ユーザーID が 3 文字未満・30 文字を超えると「3文字以上30文字以下で設定してください」と表示し、保存できない', { tag: ['@TC-PG-REGISTER-GEN8', '@TC-PG-REGISTER-GEN14'] }, async ({ pageAs, newAccount }) => {
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

  test('ユーザーID に半角英数・ハイフン・アンダースコア以外の文字を含むと「利用できない文字が含まれています」と表示する', { tag: ['@TC-PG-REGISTER-GEN9', '@TC-PG-REGISTER-GEN14'] }, async ({ pageAs, newAccount, tag }) => {
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

  test('他のユーザーが使っているユーザーID は「既に使われています」と表示し、大文字と小文字は区別しない', { tag: ['@TC-PG-REGISTER-GEN10', '@TC-PG-REGISTER-GEN11', '@TC-PG-REGISTER-GEN14'] }, async ({ pageAs, newAccount }) => {
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

  test('他のユーザーが使っているかを確かめている間は、入力欄に読み込み中のアイコンを表示する', { tag: ['@TC-PG-REGISTER-GEN12'] }, async ({ pageAs, newAccount, tag }) => {
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

  test('名前が空だと「必須です」と表示し、保存できない', { tag: ['@TC-PG-REGISTER-GEN13', '@TC-PG-REGISTER-GEN14'] }, async ({ pageAs, newAccount, tag }) => {
    const form = new UserFormPage(await pageAs(await newAccount({ username: null })))
    await form.openNew()
    await form.fillUsername(`${tag}new`)
    await expect(form.saveButton).toBeEnabled()

    await form.name.fill('')

    await expect(form.message('必須です')).toBeVisible()
    await expect(form.saveButton).toBeDisabled()
  })

  test('「保存」を押すと、ユーザーIDを小文字にして名前とともに保存し、プロジェクト一覧に遷移する', { tag: ['@TC-PG-REGISTER-GEN15', '@TC-PG-REGISTER-GEN16'] }, async ({ pageAs, newAccount, tag }) => {
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

  test('【既知の問題】ユーザーID に触れずに「保存」を押せ、メッセージも出ずにこの画面に戻される（あるべき: ユーザーID が空のままでは保存できない）', { annotation: [knownIssue('docs/ISSUES.md', '初回のユーザー登録でユーザーIDを入れずに保存できる')] }, async ({ pageAs, newAccount }) => {
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

test('登録済みのユーザーが開くと、入力欄の初期値は今のユーザーIDと名前とする', { tag: ['@TC-PG-REGISTER-GEN3'] }, async ({ ownerPage, owner }) => {
  const form = new UserFormPage(ownerPage)
  await form.openNew()

  await expect(form.username).toHaveValue(owner.username!)
  await expect(form.name).toHaveValue(owner.name)
})

test.describe('ユーザーストーリー', () => {
  test('初回ログインでユーザーIDを登録すると、オーナーがそのユーザーIDで招待でき、招待されたユーザーの一覧に招待が届いて参加できる', { tag: ['@story', '@TC-PG-REGISTER-US1'] }, async ({ ownerPage, project, pageAs, newAccount, tag }) => {
    // 初めてログインした研究者が、ユーザーIDを決めて登録する
    const page = await pageAs(await newAccount({ username: null }))
    const form = new UserFormPage(page)
    await form.openNew()
    const username = `${tag}-researcher`
    await form.fillUsername(username)
    await expect(form.saveButton).toBeEnabled()
    await form.save()
    await expect(page).toHaveURL('/')

    // オーナーが、登録したユーザーIDで招待する
    const settings = new ProjectSettingsPage(ownerPage, project.id)
    await settings.open('ユーザー管理')
    await settings.invite(username)
    await expect(settings.userRow(username).getByRole('cell').nth(2)).toHaveText('招待中')

    // 研究者のプロジェクト一覧に招待が届き、承認するとプロジェクトに参加できる
    const list = new ProjectListPage(page)
    await list.open()
    await expect(list.invitation(project.name)).toBeVisible()
    await list.acceptButton(project.name).click()
    await expect(list.row(project.name)).toBeVisible()
    await list.detailButton(project.name).click()
    await expect(page).toHaveURL(`/projects/${project.id}`)
  })

  test('初回ログインで表示される名前を決めて登録すると、自分のプロジェクトに参加した相手の一覧に、その名前がオーナーとして表示される', { tag: ['@story', '@TC-PG-REGISTER-US2'] }, async ({ pageAs, newAccount, tag }) => {
    // 初めてログインした研究者が、Google アカウントの名前から、共同作業の相手に分かる名前に変えて登録する
    const page = await pageAs(await newAccount({ username: null, name: `Google の名前${tag}` }))
    const form = new UserFormPage(page)
    await form.openNew()
    await form.fillUsername(`${tag}-researcher`)
    await form.name.fill(`採集担当${tag}`)
    await expect(form.saveButton).toBeEnabled()
    await form.save()
    await expect(page).toHaveURL('/')
    const list = new ProjectListPage(page)
    await expect(list.layout.userMenuButton(`採集担当${tag}`)).toBeVisible()

    // プロジェクトを作り、共同作業の相手を招待する
    await list.newProjectButton.click()
    await list.blankProjectItem.click()
    await expect(page).toHaveURL(/\/projects\/\d+$/)
    const projectId = Number(new URL(page.url()).pathname.split('/').pop())
    const partner = await newAccount({ suffix: 'partner' })
    const settings = new ProjectSettingsPage(page, projectId)
    await settings.open('ユーザー管理')
    await settings.invite(partner.username!)
    await expect(settings.userRow(partner.username!)).toBeVisible()

    // 相手は、招待を承認すると、一覧のオーナーに登録した名前を見る（Google アカウントの名前ではない）
    const partnerList = new ProjectListPage(await pageAs(partner))
    await partnerList.open()
    await partnerList.acceptButton('無題のプロジェクト').click()
    await expect(partnerList.cell('無題のプロジェクト', 'owner')).toHaveText(`採集担当${tag}`)
  })
})
