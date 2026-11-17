import type { Page } from '@playwright/test'
import { expect, test } from '../../fixtures'
import { LoginPage } from '../../pages/LoginPage'
import { ProjectListPage } from '../../pages/ProjectListPage'
import { ProjectScreens } from '../../pages/ProjectScreens'
import { UserFormPage } from '../../pages/UserFormPage'
import type { ProductApi, Project } from '../../support/api'
import type { Account } from '../../support/db'
import { knownIssue, spec, withIssue } from '../../support/spec'

/** オーナーのプロジェクトに招待し、承認させて編集者にする */
async function makeEditor(ownerApi: ProductApi, project: Project, editor: Account, editorApi: ProductApi) {
  await ownerApi.invite(project.id, editor.username!)
  await editorApi.accept(project.id, editor.id)
}

/** タブの名前（開いているタブには、読み上げ用の「Current page:」が前に付く） */
function tabs(...names: string[]) {
  return names.map((name) => new RegExp(`(^|\\s)${name}$`))
}

/** プロジェクトの画面（テーブルビュー・カード入力ビュー・グリッドビュー・カード印刷ビュー・プロジェクト設定）のパス */
function projectScreenPaths(projectId: number, cardId: number) {
  const paths = ProjectScreens.paths(projectId, cardId)
  return { テーブルビュー: paths.table, カード入力ビュー: paths.card, グリッドビュー: paths.grid, カード印刷ビュー: paths.print, プロジェクト設定: paths.settings }
}

/** プロジェクトの画面を開き、プロジェクトの内容（プロジェクト名）を表示したことを確かめる */
async function expectProjectScreen(page: Page, path: string, project: Project) {
  const screens = new ProjectScreens(page)
  await screens.open(path)
  await expect(page, path).toHaveURL(path)
  if (path === `/projects/${project.id}`) {
    await expect(screens.projectNameInput, path).toHaveValue(project.name)
  } else {
    await expect(screens.text(project.name), path).toBeVisible()
  }
}

test.describe('ロール', () => {
  test('オーナーは、ユーザー管理の「権限」に「管理者」と表示し、インポート・ユーザー管理・プロジェクト削除ができる', spec('features/roles.md',
    'オーナー | プロジェクトを作成したユーザー',
  ), async ({ ownerPage, owner, project }) => {
    const screens = new ProjectScreens(ownerPage)
    await screens.open(ProjectScreens.paths(project.id).settingsUsers)

    await expect(screens.userCell(owner.username!, 'role')).toHaveText('管理者')
    await expect(screens.inviteButton).toBeVisible()
    await screens.settingsTab('インポート').click()
    await expect(ownerPage.getByRole('button', { name: 'インポート', exact: true })).toBeVisible()
    await screens.settingsTab('プロジェクト削除').click()
    await expect(screens.deleteProjectButton).toBeVisible()
  })

  test('編集者は、ユーザー管理の「権限」が空欄で、カードの追加・プロジェクト名の変更・エクスポートができる', spec('features/roles.md',
    '編集者 | オーナーの招待を承認したユーザー',
  ), async ({ ownerPage, ownerApi, project, newAccount, apiAs, pageAs, tag }) => {
    const editor = await newAccount({ suffix: 'editor' })
    await makeEditor(ownerApi, project, editor, await apiAs(editor))

    const owner = new ProjectScreens(ownerPage)
    await owner.open(ProjectScreens.paths(project.id).settingsUsers)
    await expect(owner.userCell(editor.username!, 'role')).toHaveText('')
    await expect(owner.userCell(editor.username!, 'status')).toHaveText('')

    const page = await pageAs(editor)
    const screens = new ProjectScreens(page)
    await screens.open(ProjectScreens.paths(project.id).table)
    // カードの追加
    await screens.addCardButton.click()
    await expect(screens.layout.toast('追加しました')).toBeVisible()
    await expect(screens.tableRows).toHaveCount(1)
    // プロジェクト名の変更
    await screens.projectNameInput.fill(`編集者が変えた${tag}`)
    await expect(screens.layout.savedIcon).toHaveCSS('opacity', '1')
    expect((await ownerApi.call<Project>('get', `/api/projects/${project.id}`)).name).toBe(`編集者が変えた${tag}`)
    // エクスポート
    await screens.open(ProjectScreens.paths(project.id).settings)
    await expect(screens.exportButton).toBeVisible()
  })

  test('招待中のユーザーは、ユーザー管理の「ステータス」に「招待中」と表示し、プロジェクト一覧で承認・拒否だけができる', spec('features/roles.md',
    '招待中のユーザー | オーナーに招待され',
  ), async ({ ownerPage, ownerApi, project, newAccount, pageAs }) => {
    const invited = await newAccount({ suffix: 'invited' })
    await ownerApi.invite(project.id, invited.username!)

    const owner = new ProjectScreens(ownerPage)
    await owner.open(ProjectScreens.paths(project.id).settingsUsers)
    await expect(owner.userCell(invited.username!, 'status')).toHaveText('招待中')

    const page = await pageAs(invited)
    const list = new ProjectListPage(page)
    await list.open()
    await expect(list.acceptButton(project.name)).toBeVisible()
    await expect(list.denyButton(project.name)).toBeVisible()
    await expect(list.row(project.name)).toHaveCount(0)
    // プロジェクトの画面は開けない
    const response = await page.goto(ProjectScreens.paths(project.id).table)
    expect(response?.status()).toBe(404)
  })
})

test.describe('ログイン', () => {
  test('ログインせずにログイン画面以外を開くと、ログイン画面に遷移する', spec('features/roles.md',
    'ログイン > ログイン画面以外の画面は',
    'ログイン > ログイン画面以外の画面は > **IF** ログインせずにログイン画面以外を開いた場合',
  ), async ({ pageAs, project, ownerApi }) => {
    const card = await ownerApi.addCard(project.id)
    const page = await pageAs('guest')
    const paths = ['/', '/users/new', '/users/edit', ...Object.values(ProjectScreens.paths(project.id, card.id))]

    for (const path of paths) {
      await page.goto(path)
      await expect(page, path).toHaveURL('/login')
      await expect(new LoginPage(page).googleButton, path).toBeVisible()
    }
  })

  test('ログインしているがユーザーIDを登録していない場合、ログイン画面以外のどの画面を開いてもユーザー登録に遷移する', spec('features/roles.md',
    'ログイン > **WHERE** ログインしているがユーザーIDを登録していない場合',
  ), async ({ pageAs, newAccount, project, ownerApi }) => {
    const card = await ownerApi.addCard(project.id)
    const page = await pageAs(await newAccount({ username: null }))
    const paths = ['/', '/users/edit', ...Object.values(ProjectScreens.paths(project.id, card.id))]

    for (const path of paths) {
      await page.goto(path)
      await expect(page, path).toHaveURL('/users/new')
      await expect(new UserFormPage(page).username, path).toHaveValue('')
    }
    // ログイン画面は開ける
    await page.goto('/login')
    await expect(page).toHaveURL('/login')
  })
})

test.describe('プロジェクトへのアクセス', () => {
  test('オーナー・編集者は、そのプロジェクトの画面を表示する', spec('features/roles.md',
    'プロジェクトへのアクセス > **WHERE** プロジェクトのメンバーの場合',
  ), async ({ ownerPage, ownerApi, project, newAccount, apiAs, pageAs }) => {
    const card = await ownerApi.addCard(project.id)
    const editor = await newAccount({ suffix: 'editor' })
    await makeEditor(ownerApi, project, editor, await apiAs(editor))
    const editorPage = await pageAs(editor)

    for (const page of [ownerPage, editorPage]) {
      for (const path of Object.values(projectScreenPaths(project.id, card.id))) {
        await expectProjectScreen(page, path, project)
      }
    }
  })

  test('メンバーでないプロジェクトの画面を開くと、エラー画面（404）を表示する', spec('features/roles.md',
    'プロジェクトへのアクセス > **IF** メンバーでないプロジェクトの画面を開いた場合',
    'features/common-layout.md > エラー画面 > **IF** 存在しない画面・権限のない画面を開いた場合',
  ), async ({ ownerApi, project, newAccount, pageAs }) => {
    const card = await ownerApi.addCard(project.id)
    const page = await pageAs(await newAccount({ suffix: 'stranger' }))
    const screens = new ProjectScreens(page)

    for (const path of Object.values(ProjectScreens.paths(project.id, card.id))) {
      const response = await page.goto(path)
      expect(response?.status(), path).toBe(404)
      await expect(screens.layout.errorCode(404), path).toBeVisible()
      await expect(screens.text(project.name), path).toHaveCount(0)
    }
  })

  test('招待中のユーザーも、承認するまではメンバーでないものとして、エラー画面（404）を表示する', spec('features/roles.md',
    'プロジェクトへのアクセス > **IF** メンバーでないプロジェクトの画面を開いた場合 > 招待中のユーザーも',
  ), async ({ ownerApi, project, newAccount, pageAs, apiAs }) => {
    const card = await ownerApi.addCard(project.id)
    const invited = await newAccount({ suffix: 'invited' })
    await ownerApi.invite(project.id, invited.username!)
    const page = await pageAs(invited)
    const screens = new ProjectScreens(page)

    for (const path of Object.values(projectScreenPaths(project.id, card.id))) {
      const response = await page.goto(path)
      expect(response?.status(), path).toBe(404)
      await expect(screens.layout.errorCode(404), path).toBeVisible()
    }

    // 承認すると開ける
    await (await apiAs(invited)).accept(project.id, invited.id)
    await expectProjectScreen(page, ProjectScreens.paths(project.id).table, project)
  })

  test('オーナーは、プロジェクト設定に「全般」「インポート」「ユーザー管理」「プロジェクト削除」のタブを表示する', spec('features/roles.md',
    'プロジェクトへのアクセス > **WHERE** オーナーの場合',
  ), async ({ ownerPage, project }) => {
    const screens = new ProjectScreens(ownerPage)
    await screens.open(ProjectScreens.paths(project.id).settings)

    await expect(screens.settingsTabs).toHaveText(tabs('全般', 'インポート', 'ユーザー管理', 'プロジェクト削除'))
  })

  test('編集者は、プロジェクト設定に「全般」のタブだけを表示する', spec('features/roles.md',
    'プロジェクトへのアクセス > **WHERE** 編集者の場合',
  ), async ({ ownerApi, project, newAccount, apiAs, pageAs }) => {
    const editor = await newAccount({ suffix: 'editor' })
    await makeEditor(ownerApi, project, editor, await apiAs(editor))
    const screens = new ProjectScreens(await pageAs(editor))
    await screens.open(ProjectScreens.paths(project.id).settings)

    await expect(screens.exportButton).toBeVisible()
    await expect(screens.settingsTabs).toHaveText(tabs('全般'))
  })

  test('オーナーの行には削除のボタンが無く、オーナーを変えたり外したりはできない', spec('features/roles.md',
    'プロジェクトへのアクセス > オーナーを変えたり',
  ), async ({ ownerPage, owner, ownerApi, project, newAccount, apiAs }) => {
    const editor = await newAccount({ suffix: 'editor' })
    await makeEditor(ownerApi, project, editor, await apiAs(editor))
    const screens = new ProjectScreens(ownerPage)
    await screens.open(ProjectScreens.paths(project.id).settingsUsers)

    // 編集者の行には削除のボタンがあり、オーナーの行には無い。権限を変える操作も無い
    await expect(screens.userCell(editor.username!, 'actions').getByRole('button')).toBeVisible()
    await expect(screens.userCell(owner.username!, 'actions').getByRole('button')).toHaveCount(0)
    await expect(screens.userCell(owner.username!, 'role').getByRole('button')).toHaveCount(0)
    await expect(screens.userCell(owner.username!, 'role').getByRole('combobox')).toHaveCount(0)
  })

  test('編集者は、自分でプロジェクトから抜けられない（抜ける操作が無い）', spec('features/roles.md',
    'プロジェクトへのアクセス > 編集者は、自分でプロジェクトから抜けられない',
  ), async ({ ownerApi, project, newAccount, apiAs, pageAs }) => {
    const editor = await newAccount({ suffix: 'editor' })
    await makeEditor(ownerApi, project, editor, await apiAs(editor))
    const page = await pageAs(editor)

    // プロジェクト一覧の行には「詳細」だけがある
    const list = new ProjectListPage(page)
    await list.open()
    await expect(list.row(project.name).getByRole('button')).toHaveCount(0)
    await expect(list.row(project.name).getByRole('link')).toHaveText(['詳細'])
    // プロジェクト設定は「全般」だけで、ボタンは「エクスポート」だけ
    const screens = new ProjectScreens(page)
    await screens.open(ProjectScreens.paths(project.id).settings)
    await expect(screens.settingsTabs).toHaveText(tabs('全般'))
    await expect(page.getByRole('button')).toHaveText(['エクスポート'])
  })
})

test('【実装との乖離】編集者がユーザー管理などの URL を直接開くと、その画面を表示する（あるべき: タブと同じく表示しない）', withIssue(
  spec('features/roles.md', 'プロジェクトへのアクセス > **WHERE** 編集者の場合'),
  knownIssue('features/roles.md', '編集者にはプロジェクト設定の「インポート」「ユーザー管理」「プロジェクト削除」のタブを表示しないが、URL を直接開くとその画面を表示する'),
), async ({ owner, ownerApi, project, newAccount, apiAs, pageAs, tag }) => {
  const editor = await newAccount({ suffix: 'editor' })
  await makeEditor(ownerApi, project, editor, await apiAs(editor))
  const invited = await newAccount({ suffix: 'invited' })
  await ownerApi.invite(project.id, invited.username!)
  const page = await pageAs(editor)
  const screens = new ProjectScreens(page)

  // ユーザー管理: メンバーの一覧（招待中のユーザーを除く）が見え、招待・削除のボタンもある
  await screens.open(ProjectScreens.paths(project.id).settingsUsers)
  await expect(screens.userRow(owner.username!)).toBeVisible()
  await expect(screens.userRow(editor.username!)).toBeVisible()
  await expect(screens.userRow(invited.username!)).toHaveCount(0)
  await expect(screens.inviteButton).toBeVisible()
  await expect(screens.userCell(editor.username!, 'actions').getByRole('button')).toBeVisible()
  // 招待を押しても、サーバーが受け付けない
  const other = await newAccount({ suffix: 'other' })
  await screens.inviteInput.fill(other.username!)
  await screens.inviteButton.click()
  await expect(page.getByText('存在しないIDです')).toBeVisible()

  // インポート: インポートの画面を表示する
  await screens.open(ProjectScreens.paths(project.id).settingsImport)
  await expect(page.getByRole('button', { name: 'インポート', exact: true })).toBeVisible()

  // プロジェクト削除: ボタンを表示するが、押してもサーバーが受け付けない
  await screens.open(ProjectScreens.paths(project.id).settingsDelete)
  await expect(screens.deleteProjectButton).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept())
  const response = page.waitForResponse((r) => new URL(r.url()).pathname === `/api/projects/${project.id}` && r.request().method() === 'DELETE')
  await screens.deleteProjectButton.click()
  expect((await response).status()).toBe(404)
  await expect(screens.layout.toast('プロジェクトを削除しました')).toHaveCount(0)
  expect((await ownerApi.call<Project>('get', `/api/projects/${project.id}`)).name).toBe(`プロジェクト${tag}`)
})
