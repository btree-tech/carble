import { expect, test } from '../../fixtures'
import { LoginPage } from '../../pages/LoginPage'
import { ProjectListPage } from '../../pages/ProjectListPage'
import { ProjectScreens } from '../../pages/ProjectScreens'
import { ProjectSettingsPage } from '../../pages/ProjectSettingsPage'
import { UserFormPage } from '../../pages/UserFormPage'
import { knownIssue } from '../../support/spec'

test.describe('ユーザーIDと名前の変更', () => {
  test('ユーザー登録と同じ入力欄・案内・「保存」ボタンを、今のユーザーIDと名前を入れて表示する', { tag: ['@TC-PG-USERSET-EDIT1'] }, async ({ ownerPage, owner }) => {
    const form = new UserFormPage(ownerPage)
    await form.openEdit()

    await expect(form.username).toHaveValue(owner.username!)
    await expect(form.username).toHaveAttribute('placeholder', 'carble')
    await expect(form.usernameHelp).toBeVisible()
    await expect(form.name).toHaveValue(owner.name)
    await expect(form.saveButton).toBeEnabled()
  })

  test('ユーザー登録と同じ確かめ方で、入力に問題があると表示して保存できない', { tag: ['@TC-PG-USERSET-EDIT1'] }, async ({ ownerPage, newAccount }) => {
    const other = await newAccount({ suffix: 'other' })
    const form = new UserFormPage(ownerPage)
    await form.openEdit()

    const cases: [string, string][] = [
      ['ab', '3文字以上30文字以下で設定してください'],
      ['a'.repeat(31), '3文字以上30文字以下で設定してください'],
      ['abc.def', '利用できない文字が含まれています'],
      [other.username!, '既に使われています'],
      [other.username!.toUpperCase(), '既に使われています'],
    ]
    for (const [value, message] of cases) {
      await form.fillUsername(value)
      await expect(form.message(message), value).toBeVisible()
      await expect(form.saveButton).toBeDisabled()
    }

    await form.fillUsername(`${other.username}-free`)
    await form.name.fill('')
    await expect(form.message('必須です')).toBeVisible()
    await expect(form.saveButton).toBeDisabled()
  })

  test('自分の今のユーザーID は「既に使われています」としない', { tag: ['@TC-PG-USERSET-EDIT2'] }, async ({ ownerPage, owner }) => {
    const form = new UserFormPage(ownerPage)
    await form.openEdit()

    // 一度変えてから、今のユーザーID に戻す
    await form.fillUsername(`${owner.username}x`)
    await expect(form.saveButton).toBeEnabled()
    await form.fillUsername(owner.username!)

    await expect(form.saveButton).toBeEnabled()
    await expect(form.message('既に使われています')).toBeHidden()
  })

  test('【既知の問題】自分の今のユーザーID の大文字・小文字だけを変えると「既に使われています」と表示し、保存できない（あるべき: 自分のユーザーID として保存できる）', { annotation: [knownIssue('docs/ISSUES.md', '自分のユーザーIDの大文字・小文字だけを変えると「既に使われています」と表示する')] }, async ({ ownerPage, owner }) => {
    const form = new UserFormPage(ownerPage)
    await form.openEdit()

    await form.fillUsername(owner.username!.toUpperCase())

    await expect(form.message('既に使われています')).toBeVisible()
    await expect(form.saveButton).toBeDisabled()
  })

  test('ほかの画面へのリンクは表示しない', { tag: ['@TC-PG-USERSET-EDIT3'] }, async ({ ownerPage }) => {
    const form = new UserFormPage(ownerPage)
    await form.openEdit()

    await expect(form.saveButton).toBeVisible()
    await expect(form.links).toHaveCount(0)
  })

  test('「保存」を押すと、ユーザーIDと名前を保存し、プロジェクト一覧に遷移する', { tag: ['@TC-PG-USERSET-EDIT4'] }, async ({ ownerPage, tag }) => {
    const form = new UserFormPage(ownerPage)
    await form.openEdit()

    await form.fillUsername(`${tag}-changed`)
    await form.name.fill(`変えた名前${tag}`)
    await expect(form.saveButton).toBeEnabled()
    await form.save()

    await expect(ownerPage).toHaveURL('/')
    await expect(new ProjectListPage(ownerPage).layout.userMenuButton(`変えた名前${tag}`)).toBeVisible()
    await form.openEdit()
    await expect(form.username).toHaveValue(`${tag}-changed`)
    await expect(form.name).toHaveValue(`変えた名前${tag}`)
  })
})

test.describe('ユーザーデータの削除', () => {
  test('入力欄の下に、区切り線をはさんで「ユーザーデータを削除」ボタンを表示する', { tag: ['@TC-PG-USERSET-DEL1'] }, async ({ ownerPage }) => {
    const form = new UserFormPage(ownerPage)
    await form.openEdit()

    await expect(form.deleteButton).toBeVisible()
    const save = await form.saveButton.boundingBox()
    const remove = await form.deleteButton.boundingBox()
    expect(remove!.y).toBeGreaterThan(save!.y + save!.height)
  })

  test('「ユーザーデータを削除」を押すと「本当に削除しますか？」と確認し、キャンセルすると何もしない', { tag: ['@TC-PG-USERSET-DEL2', '@TC-PG-USERSET-DEL5'] }, async ({ ownerPage, owner, project }) => {
    const form = new UserFormPage(ownerPage)
    await form.openEdit()

    const message = await form.deleteUser('dismiss')

    expect(message).toBe('本当に削除しますか？')
    await expect(ownerPage).toHaveURL('/users/edit')
    await expect(form.deleteButton).toBeEnabled()
    // ログインしたままで、プロジェクトもそのまま
    const list = new ProjectListPage(ownerPage)
    await list.open()
    await expect(list.layout.userMenuButton(owner.name)).toBeVisible()
    await expect(list.row(project.name)).toBeVisible()
  })

  test('確認すると、ユーザーを削除してログアウトし、ログイン画面に遷移する', { tag: ['@TC-PG-USERSET-DEL3'] }, async ({ pageAs, newAccount }) => {
    const account = await newAccount()
    const page = await pageAs(account)
    const form = new UserFormPage(page)
    await form.openEdit()

    await form.deleteUser('accept')

    await expect(page).toHaveURL('/login')
    await expect(new LoginPage(page).googleButton).toBeVisible()
    // ログアウトしているので、ほかの画面を開くとログイン画面に戻る
    await page.goto('/users/edit')
    await expect(page).toHaveURL('/login')
  })

  test('削除すると、参加していたプロジェクトのメンバーから外れ、受けていた招待も消える', { tag: ['@TC-PG-USERSET-DEL4'] }, async ({ ownerPage, ownerApi, project, newAccount, pageAs, apiAs, tag }) => {
    const invitedProject = await ownerApi.createProject(`招待中${tag}`)
    const member = await newAccount({ suffix: 'member' })
    await ownerApi.invite(project.id, member.username!)
    await (await apiAs(member)).accept(project.id, member.id)
    await ownerApi.invite(invitedProject.id, member.username!)

    const owner = new ProjectScreens(ownerPage)
    await owner.open(ProjectScreens.paths(project.id).settingsUsers)
    await expect(owner.userRow(member.username!)).toBeVisible()

    const page = await pageAs(member)
    const form = new UserFormPage(page)
    await form.openEdit()
    await form.deleteUser('accept')
    await expect(page).toHaveURL('/login')

    // オーナーのユーザー管理の一覧から、メンバーも招待中のユーザーも消える
    await owner.open(ProjectScreens.paths(project.id).settingsUsers)
    await expect(owner.userRow(member.username!)).toHaveCount(0)
    await owner.open(ProjectScreens.paths(invitedProject.id).settingsUsers)
    await expect(owner.inviteInput).toBeVisible()
    await expect(owner.userRow(member.username!)).toHaveCount(0)
  })

  test('【既知の問題】オーナーが削除しても、プロジェクトが残り、編集者のプロジェクト一覧がエラー画面（500）になる（あるべき: プロジェクトも消えるか、一覧を表示できる）', { annotation: [knownIssue('docs/ISSUES.md', 'ユーザーを削除してもオーナーのプロジェクトが残る')] }, async ({ ownerPage, ownerApi, project, newAccount, pageAs, apiAs }) => {
    const editor = await newAccount({ suffix: 'editor' })
    await ownerApi.invite(project.id, editor.username!)
    const editorApi = await apiAs(editor)
    await editorApi.accept(project.id, editor.id)

    const form = new UserFormPage(ownerPage)
    await form.openEdit()
    await form.deleteUser('accept')
    await expect(ownerPage).toHaveURL('/login')

    // プロジェクトは残り、編集者は開ける
    const editorPage = await pageAs(editor)
    const screens = new ProjectScreens(editorPage)
    await screens.open(ProjectScreens.paths(project.id).grid)
    await expect(screens.text(project.name)).toBeVisible()

    // 編集者のプロジェクト一覧は、オーナー名を表示できずエラー画面になる
    await editorPage.goto('/')
    await expect(screens.layout.errorCode(500)).toBeVisible()
  })
})

test.describe('ユーザーストーリー', () => {
  test('ユーザーメニューの「設定」からユーザーIDと名前を変えると、共同作業の相手のプロジェクト一覧とユーザー管理に、変えた名前とユーザーIDが表示される', { tag: ['@story', '@TC-PG-USERSET-US1'] }, async ({ ownerPage, owner, ownerApi, project, newAccount, apiAs, pageAs, tag }) => {
    // 研究者（owner）と相手が、互いのプロジェクトの編集者になっている
    const partner = await newAccount({ suffix: 'partner' })
    const partnerApi = await apiAs(partner)
    await ownerApi.invite(project.id, partner.username!)
    await partnerApi.accept(project.id, partner.id)
    const partnerProject = await partnerApi.createProject(`相手の${tag}`)
    await partnerApi.invite(partnerProject.id, owner.username!)
    await ownerApi.accept(partnerProject.id, owner.id)

    // 研究者が、プロジェクト一覧のユーザーメニューから設定を開き、ユーザーIDと名前を変える
    const list = new ProjectListPage(ownerPage)
    await list.open()
    await list.layout.chooseUserMenu(owner.name, '設定')
    await expect(ownerPage).toHaveURL('/users/edit')
    const form = new UserFormPage(ownerPage)
    await expect(form.username).toHaveValue(owner.username!)
    await expect(form.name).toHaveValue(owner.name)
    const username = `${tag}-renamed`
    await form.fillUsername(username)
    await form.name.fill(`分かりやすい名前${tag}`)
    await expect(form.saveButton).toBeEnabled()
    await form.save()
    await expect(ownerPage).toHaveURL('/')
    await expect(list.layout.userMenuButton(`分かりやすい名前${tag}`)).toBeVisible()

    // 相手のプロジェクト一覧では、研究者のプロジェクトのオーナーが変えた名前になる
    const partnerPage = await pageAs(partner)
    const partnerList = new ProjectListPage(partnerPage)
    await partnerList.open()
    await expect(partnerList.cell(project.name, 'owner')).toHaveText(`分かりやすい名前${tag}`)

    // 相手のプロジェクトのユーザー管理では、研究者が変えたユーザーIDで並ぶ
    const settings = new ProjectSettingsPage(partnerPage, partnerProject.id)
    await settings.open('ユーザー管理')
    await expect(settings.userRow(username)).toBeVisible()
    await expect(settings.userRow(owner.username!)).toHaveCount(0)
  })

  test('使わなくなった研究者がユーザーデータを削除すると、参加していたプロジェクトと招待から消え、同じユーザーIDを別の人が登録できる', { tag: ['@story', '@TC-PG-USERSET-US2'] }, async ({ ownerPage, ownerApi, project, newAccount, apiAs, pageAs, tag }) => {
    // 研究者は、オーナーのプロジェクトの編集者で、別のプロジェクトにも招待されている（自分がオーナーのプロジェクトは持たない）
    const researcher = await newAccount({ suffix: 'researcher' })
    await ownerApi.invite(project.id, researcher.username!)
    await (await apiAs(researcher)).accept(project.id, researcher.id)
    const invitedProject = await ownerApi.createProject(`招待中${tag}`)
    await ownerApi.invite(invitedProject.id, researcher.username!)

    // 研究者が、プロジェクト一覧のユーザーメニューから設定を開き、ユーザーデータを削除する
    const page = await pageAs(researcher)
    const list = new ProjectListPage(page)
    await list.open()
    await expect(list.row(project.name)).toBeVisible()
    await list.layout.chooseUserMenu(researcher.name, '設定')
    await expect(page).toHaveURL('/users/edit')
    const form = new UserFormPage(page)
    await expect(form.name).toHaveValue(researcher.name)
    expect(await form.deleteUser('accept')).toBe('本当に削除しますか？')
    await expect(page).toHaveURL('/login')

    // オーナーのユーザー管理から、研究者のユーザーIDが消える（メンバー・招待中とも）
    const settings = new ProjectSettingsPage(ownerPage, project.id)
    await settings.open('ユーザー管理')
    await expect(settings.inviteInput).toBeVisible()
    await expect(settings.userRow(researcher.username!)).toHaveCount(0)
    const invitedSettings = new ProjectSettingsPage(ownerPage, invitedProject.id)
    await invitedSettings.open('ユーザー管理')
    await expect(invitedSettings.inviteInput).toBeVisible()
    await expect(invitedSettings.userRow(researcher.username!)).toHaveCount(0)

    // ユーザーIDも残らないので、初めてログインした別の人が同じユーザーIDで登録できる
    const newcomerPage = await pageAs(await newAccount({ suffix: 'newcomer', username: null }))
    const newcomer = new UserFormPage(newcomerPage)
    await newcomer.openNew()
    const checked = newcomerPage.waitForResponse((r) => new URL(r.url()).pathname === '/api/auth/is-username-available')
    await newcomer.fillUsername(researcher.username!)
    await checked
    await expect(newcomer.message('既に使われています')).toBeHidden()
    await expect(newcomer.saveButton).toBeEnabled()
    await newcomer.save()
    await expect(newcomerPage).toHaveURL('/')
  })
})
