import type { Page } from '@playwright/test'
import { expect, test } from '../../fixtures'
import { LoginPage } from '../../pages/LoginPage'
import { ProjectListPage } from '../../pages/ProjectListPage'
import { ProjectScreens } from '../../pages/ProjectScreens'
import { ProjectSettingsPage } from '../../pages/ProjectSettingsPage'
import { TableViewPage } from '../../pages/TableViewPage'
import { UserFormPage } from '../../pages/UserFormPage'
import type { ProductApi, Project } from '../../support/api'
import type { Account } from '../../support/db'
import { open } from '../../support/navigation'
import { knownIssue } from '../../support/spec'

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
  test('オーナーは、ユーザー管理の「権限」に「管理者」と表示し、インポート・ユーザー管理・プロジェクト削除ができる', { tag: ['@TC-FT-ROLES-GEN1'] }, async ({ ownerPage, owner, project }) => {
    const screens = new ProjectScreens(ownerPage)
    await screens.open(ProjectScreens.paths(project.id).settingsUsers)

    await expect(screens.userCell(owner.username!, 'role')).toHaveText('管理者')
    await expect(screens.inviteButton).toBeVisible()
    await screens.settingsTab('インポート').click()
    await expect(ownerPage.getByRole('button', { name: 'インポート', exact: true })).toBeVisible()
    await screens.settingsTab('プロジェクト削除').click()
    await expect(screens.deleteProjectButton).toBeVisible()
  })

  test('編集者は、ユーザー管理の「権限」が空欄で、カードの追加・プロジェクト名の変更・エクスポートができる', { tag: ['@TC-FT-ROLES-GEN2'] }, async ({ ownerPage, ownerApi, project, newAccount, apiAs, pageAs, tag }) => {
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

  test('招待中のユーザーは、ユーザー管理の「ステータス」に「招待中」と表示し、プロジェクト一覧で承認・拒否だけができる', { tag: ['@TC-FT-ROLES-GEN3'] }, async ({ ownerPage, ownerApi, project, newAccount, pageAs }) => {
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
  test('ログインせずにログイン画面以外を開くと、ログイン画面に遷移する', { tag: ['@TC-FT-ROLES-LOGI1', '@TC-FT-ROLES-LOGI2'] }, async ({ pageAs, project, ownerApi }) => {
    const card = await ownerApi.addCard(project.id)
    const page = await pageAs('guest')
    const paths = ['/', '/users/new', '/users/edit', ...Object.values(ProjectScreens.paths(project.id, card.id))]

    for (const path of paths) {
      await page.goto(path)
      await expect(page, path).toHaveURL('/login')
      await expect(new LoginPage(page).googleButton, path).toBeVisible()
    }
  })

  test('ログインしているがユーザーIDを登録していない場合、ログイン画面以外のどの画面を開いてもユーザー登録に遷移する', { tag: ['@TC-FT-ROLES-LOGI3'] }, async ({ pageAs, newAccount, project, ownerApi }) => {
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
  test('オーナー・編集者は、そのプロジェクトの画面を表示する', { tag: ['@TC-FT-ROLES-ACC1'] }, async ({ ownerPage, ownerApi, project, newAccount, apiAs, pageAs }) => {
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

  test('メンバーでないプロジェクトの画面を開くと、エラー画面（404）を表示する', { tag: ['@TC-FT-ROLES-ACC2', '@TC-FT-LAYOUT-ERR1'] }, async ({ ownerApi, project, newAccount, pageAs }) => {
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

  test('招待中のユーザーも、承認するまではメンバーでないものとして、エラー画面（404）を表示する', { tag: ['@TC-FT-ROLES-ACC3'] }, async ({ ownerApi, project, newAccount, pageAs, apiAs }) => {
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

  test('オーナーは、プロジェクト設定に「全般」「インポート」「ユーザー管理」「プロジェクト削除」のタブを表示する', { tag: ['@TC-FT-ROLES-ACC4'] }, async ({ ownerPage, project }) => {
    const screens = new ProjectScreens(ownerPage)
    await screens.open(ProjectScreens.paths(project.id).settings)

    await expect(screens.settingsTabs).toHaveText(tabs('全般', 'インポート', 'ユーザー管理', 'プロジェクト削除'))
  })

  test('編集者は、プロジェクト設定に「全般」のタブだけを表示する', { tag: ['@TC-FT-ROLES-ACC5'] }, async ({ ownerApi, project, newAccount, apiAs, pageAs }) => {
    const editor = await newAccount({ suffix: 'editor' })
    await makeEditor(ownerApi, project, editor, await apiAs(editor))
    const screens = new ProjectScreens(await pageAs(editor))
    await screens.open(ProjectScreens.paths(project.id).settings)

    await expect(screens.exportButton).toBeVisible()
    await expect(screens.settingsTabs).toHaveText(tabs('全般'))
  })

  test('オーナーの行には削除のボタンが無く、オーナーを変えたり外したりはできない', { tag: ['@TC-FT-ROLES-ACC6'] }, async ({ ownerPage, owner, ownerApi, project, newAccount, apiAs }) => {
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

  test('編集者は、自分でプロジェクトから抜けられない（抜ける操作が無い）', { tag: ['@TC-FT-ROLES-ACC7'] }, async ({ ownerApi, project, newAccount, apiAs, pageAs }) => {
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

test('【実装との乖離】編集者がユーザー管理などの URL を直接開くと、その画面を表示する（あるべき: タブと同じく表示しない）', { annotation: [knownIssue('features/roles.md', '編集者にはプロジェクト設定の「インポート」「ユーザー管理」「プロジェクト削除」のタブを表示しないが、URL を直接開くとその画面を表示する')] }, async ({ owner, ownerApi, project, newAccount, apiAs, pageAs, tag }) => {
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

test.describe('ユーザーストーリー', () => {
  test('初めてログインした研究者は、ユーザー登録だけでプロジェクトを作ってカードを書き始められ、自分のプロジェクトは他の研究者の一覧と混ざらない', { tag: ['@story', '@TC-FT-ROLES-US1'] }, async ({ ownerPage, project, newAccount, pageAs, tag }) => {
    // Google でログインした直後（ユーザーID 未登録）は、一覧を開こうとしてもユーザー登録に移る
    const researcher = await newAccount({ suffix: 'researcher', username: null })
    const page = await pageAs(researcher)
    await open(page, '/')
    await expect(page).toHaveURL('/users/new')
    const form = new UserFormPage(page)
    await expect(form.name).toHaveValue(researcher.name)
    await form.fillUsername(`${tag}-researcher`)
    await expect(form.saveButton).toBeEnabled()
    await form.save()

    // 登録すると一覧に移る。他の研究者（owner）のプロジェクトは並ばない
    await expect(page).toHaveURL('/')
    const list = new ProjectListPage(page)
    await expect(list.emptyMessage).toBeVisible()
    await expect(list.row(project.name)).toHaveCount(0)

    // プロジェクトを作り、名前を付けて、カードを書く
    await list.newProjectButton.click()
    await list.blankProjectItem.click()
    await expect(page).toHaveURL(/\/projects\/\d+$/)
    const projectId = Number(new URL(page.url()).pathname.split('/').pop())
    const tv = new TableViewPage(page)
    await expect(tv.projectNameInput).toHaveValue('無題のプロジェクト')
    const projectName = `採集記録${tag}`
    const renamed = page.waitForResponse((r) => r.request().method() === 'PUT' && new URL(r.url()).pathname === `/api/projects/${projectId}`)
    await tv.projectNameInput.fill(projectName)
    await renamed
    await tv.addButton.click()
    await expect(tv.toast('追加しました')).toBeVisible()
    await expect(tv.idCells).toHaveText(['1'])
    await tv.editCell(1, 'みだし', 'ヤマザクラ')

    // 一覧には自分のプロジェクトだけが並び、開くと書いたカードが残っている
    await list.open()
    await expect(list.rows).toHaveCount(1)
    await expect(list.cell(projectName, 'owner')).toHaveText(researcher.name)
    await list.detailButton(projectName).click()
    await expect(page).toHaveURL(`/projects/${projectId}`)
    await expect(await tv.cellInput(1, 'みだし')).toHaveValue('ヤマザクラ')

    // 他の研究者の一覧には並ばず、URL を開いても見られない
    const ownerList = new ProjectListPage(ownerPage)
    await ownerList.open()
    await expect(ownerList.row(project.name)).toBeVisible()
    await expect(ownerList.row(projectName)).toHaveCount(0)
    const response = await ownerPage.goto(ProjectScreens.paths(projectId).table)
    expect(response?.status()).toBe(404)
  })

  test('オーナーが 2 人を招待し、承認した人は編集者としてカードを書き足してオーナーと共同で編集でき、拒否した人はプロジェクトに入らない', { tag: ['@story', '@TC-FT-ROLES-US2'] }, async ({ ownerPage, ownerApi, project, newAccount, pageAs }) => {
    const card = await ownerApi.addCard(project.id, { みだし: 'オーナーが書いた記録' })
    const partner = await newAccount({ suffix: 'partner' })
    const declined = await newAccount({ suffix: 'declined' })

    // オーナーが、ユーザー管理で 2 人を招待する
    const settings = new ProjectSettingsPage(ownerPage, project.id)
    await settings.open('ユーザー管理')
    for (const user of [partner, declined]) {
      await settings.invite(user.username!)
      await expect(settings.userRow(user.username!).getByRole('cell').nth(2)).toHaveText('招待中')
    }

    // 1 人は承認して、オーナーのカードにメモを書き足す
    const partnerPage = await pageAs(partner)
    const partnerList = new ProjectListPage(partnerPage)
    await partnerList.open()
    await partnerList.acceptButton(project.name).click()
    await partnerList.detailButton(project.name).click()
    await expect(partnerPage).toHaveURL(`/projects/${project.id}`)
    const partnerTv = new TableViewPage(partnerPage)
    await expect(await partnerTv.cellInput(card.id, 'みだし')).toHaveValue('オーナーが書いた記録')
    await partnerTv.editCell(card.id, 'メモ', '編集者が書き足したメモ')

    // もう 1 人は拒否し、プロジェクトに入らない
    const declinedPage = await pageAs(declined)
    const declinedList = new ProjectListPage(declinedPage)
    await declinedList.open()
    await declinedList.denyButton(project.name).click()
    await expect(declinedList.invitation(project.name)).toHaveCount(0)
    await expect(declinedList.row(project.name)).toHaveCount(0)
    const response = await declinedPage.goto(ProjectScreens.paths(project.id).table)
    expect(response?.status()).toBe(404)

    // オーナーは、編集者の書き足したメモを見られ、ユーザー管理では承認した人だけがメンバーとして残る
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)
    await expect(await tv.cellInput(card.id, 'メモ')).toHaveValue('編集者が書き足したメモ')
    await settings.open('ユーザー管理')
    await expect(settings.userRow(partner.username!).getByRole('cell').nth(2)).toHaveText('')
    await expect(settings.userRow(declined.username!)).toHaveCount(0)
  })
})
