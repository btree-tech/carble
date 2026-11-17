import { expect, test } from '../../fixtures'
import { LoginPage } from '../../pages/LoginPage'
import { ProjectListPage } from '../../pages/ProjectListPage'
import { ProjectScreens } from '../../pages/ProjectScreens'
import { UserFormPage } from '../../pages/UserFormPage'
import { knownIssue, spec, withIssue } from '../../support/spec'

test.describe('ユーザーIDと名前の変更', () => {
  test('ユーザー登録と同じ入力欄・案内・「保存」ボタンを、今のユーザーIDと名前を入れて表示する', spec('pages/user-settings.md',
    'ユーザーIDと名前の変更 > ユーザー登録と同じ入力欄・確認・「保存」ボタンを表示する',
  ), async ({ ownerPage, owner }) => {
    const form = new UserFormPage(ownerPage)
    await form.openEdit()

    await expect(form.username).toHaveValue(owner.username!)
    await expect(form.username).toHaveAttribute('placeholder', 'carble')
    await expect(form.usernameHelp).toBeVisible()
    await expect(form.name).toHaveValue(owner.name)
    await expect(form.saveButton).toBeEnabled()
  })

  test('ユーザー登録と同じ確かめ方で、入力に問題があると表示して保存できない', spec('pages/user-settings.md',
    'ユーザーIDと名前の変更 > ユーザー登録と同じ入力欄・確認・「保存」ボタンを表示する',
  ), async ({ ownerPage, newAccount }) => {
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

  test('自分の今のユーザーID は「既に使われています」としない', spec('pages/user-settings.md',
    'ユーザーIDと名前の変更 > ユーザー登録と同じ入力欄・確認・「保存」ボタンを表示する > 自分の今のユーザーID は',
  ), async ({ ownerPage, owner }) => {
    const form = new UserFormPage(ownerPage)
    await form.openEdit()

    // 一度変えてから、今のユーザーID に戻す
    await form.fillUsername(`${owner.username}x`)
    await expect(form.saveButton).toBeEnabled()
    await form.fillUsername(owner.username!)

    await expect(form.saveButton).toBeEnabled()
    await expect(form.message('既に使われています')).toBeHidden()
  })

  test('【既知の問題】自分の今のユーザーID の大文字・小文字だけを変えると「既に使われています」と表示し、保存できない（あるべき: 自分のユーザーID として保存できる）', withIssue(
    spec('pages/user-settings.md', 'ユーザーIDと名前の変更 > ユーザー登録と同じ入力欄・確認・「保存」ボタンを表示する > 自分の今のユーザーID は'),
    knownIssue('docs/ISSUES.md', '自分のユーザーIDの大文字・小文字だけを変えると「既に使われています」と表示する'),
  ), async ({ ownerPage, owner }) => {
    const form = new UserFormPage(ownerPage)
    await form.openEdit()

    await form.fillUsername(owner.username!.toUpperCase())

    await expect(form.message('既に使われています')).toBeVisible()
    await expect(form.saveButton).toBeDisabled()
  })

  test('ほかの画面へのリンクは表示しない', spec('pages/user-settings.md',
    'ユーザーIDと名前の変更 > ほかの画面へのリンク',
  ), async ({ ownerPage }) => {
    const form = new UserFormPage(ownerPage)
    await form.openEdit()

    await expect(form.saveButton).toBeVisible()
    await expect(form.links).toHaveCount(0)
  })

  test('「保存」を押すと、ユーザーIDと名前を保存し、プロジェクト一覧に遷移する', spec('pages/user-settings.md',
    'ユーザーIDと名前の変更 > **WHEN** 「保存」を押すと',
  ), async ({ ownerPage, tag }) => {
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
  test('入力欄の下に、区切り線をはさんで「ユーザーデータを削除」ボタンを表示する', spec('pages/user-settings.md',
    'ユーザーデータの削除 > 入力欄の下に、区切り線をはさんで',
  ), async ({ ownerPage }) => {
    const form = new UserFormPage(ownerPage)
    await form.openEdit()

    await expect(form.deleteButton).toBeVisible()
    const save = await form.saveButton.boundingBox()
    const remove = await form.deleteButton.boundingBox()
    expect(remove!.y).toBeGreaterThan(save!.y + save!.height)
  })

  test('「ユーザーデータを削除」を押すと「本当に削除しますか？」と確認し、キャンセルすると何もしない', spec('pages/user-settings.md',
    'ユーザーデータの削除 > **WHEN** 「ユーザーデータを削除」を押すと',
    'ユーザーデータの削除 > **WHEN** 「ユーザーデータを削除」を押すと > **WHEN** 確認をキャンセルすると',
  ), async ({ ownerPage, owner, project }) => {
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

  test('確認すると、ユーザーを削除してログアウトし、ログイン画面に遷移する', spec('pages/user-settings.md',
    'ユーザーデータの削除 > **WHEN** 「ユーザーデータを削除」を押すと > **WHEN** 確認すると',
  ), async ({ pageAs, newAccount }) => {
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

  test('削除すると、参加していたプロジェクトのメンバーから外れ、受けていた招待も消える', spec('pages/user-settings.md',
    'ユーザーデータの削除 > **WHEN** 「ユーザーデータを削除」を押すと > **WHEN** 確認すると > 参加していたプロジェクトのメンバーからも外れる',
  ), async ({ ownerPage, ownerApi, project, newAccount, pageAs, apiAs, tag }) => {
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

  test('【既知の問題】オーナーが削除しても、プロジェクトが残り、編集者のプロジェクト一覧がエラー画面（500）になる（あるべき: プロジェクトも消えるか、一覧を表示できる）', withIssue(
    spec('pages/user-settings.md', 'ユーザーデータの削除 > **WHEN** 「ユーザーデータを削除」を押すと > **WHEN** 確認すると'),
    knownIssue('docs/ISSUES.md', 'ユーザーを削除してもオーナーのプロジェクトが残る'),
  ), async ({ ownerPage, ownerApi, project, newAccount, pageAs, apiAs }) => {
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
