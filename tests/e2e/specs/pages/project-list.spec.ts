import { expect, test } from '../../fixtures'
import { ProjectListPage } from '../../pages/ProjectListPage'
import { ProjectScreens } from '../../pages/ProjectScreens'
import { UserFormPage } from '../../pages/UserFormPage'
import { knownIssue } from '../../support/spec'

/** 最終更新日時は秒の単位で記録するので、並び順を確かめる前に次の秒まで待つ */
async function nextSecond() {
  const target = (Math.floor(Date.now() / 1000) + 1) * 1000
  await expect.poll(() => Date.now(), { intervals: [100] }).toBeGreaterThanOrEqual(target)
}

test.describe('ヘッダー', () => {
  test('ロゴと、ログインしているユーザーの名前のボタンを表示する', { tag: ['@TC-PG-PLIST-HDR1'] }, async ({ ownerPage, owner }) => {
    const list = new ProjectListPage(ownerPage)
    await list.open()

    await expect(list.logo).toBeVisible()
    await expect(list.layout.userMenuButton(owner.name)).toBeVisible()
  })

  test('名前のボタンを押すと「設定」「ログアウト」のメニューを開き、「設定」を選ぶと設定（ユーザー）に遷移する', { tag: ['@TC-PG-PLIST-HDR2', '@TC-PG-PLIST-HDR3'] }, async ({ ownerPage, owner }) => {
    const list = new ProjectListPage(ownerPage)
    await list.open()

    await list.layout.userMenuButton(owner.name).click()
    await expect(list.layout.menuItems).toHaveText(['設定', 'ログアウト'])

    await list.layout.menuItem('設定').click()
    await expect(ownerPage).toHaveURL('/users/edit')
    await expect(new UserFormPage(ownerPage).deleteButton).toBeVisible()
  })
})

test.describe('招待の通知', () => {
  test('招待されているプロジェクトごとに通知と「承認」「拒否」を、最終更新日時の新しい順に表示する', { tag: ['@TC-PG-PLIST-INV1', '@TC-PG-PLIST-INV2'] }, async ({ ownerApi, newAccount, pageAs, tag }) => {
    const older = await ownerApi.createProject(`古い${tag}`)
    await nextSecond()
    const newer = await ownerApi.createProject(`新しい${tag}`)
    const invited = await newAccount({ suffix: 'invited' })
    await ownerApi.invite(older.id, invited.username!)
    await ownerApi.invite(newer.id, invited.username!)

    const list = new ProjectListPage(await pageAs(invited))
    await list.open()

    for (const name of [older.name, newer.name]) {
      await expect(list.invitation(name)).toBeVisible()
      await expect(list.acceptButton(name)).toBeVisible()
      await expect(list.denyButton(name)).toBeVisible()
    }
    await expect(list.invitationTitles).toHaveText([`「${newer.name}」に招待されています`, `「${older.name}」に招待されています`])

    // 古いほうを更新すると、先頭に来る
    await nextSecond()
    await ownerApi.call('put', `/api/projects/${older.id}`, { name: `更新した${tag}` })
    await list.open()
    await expect(list.invitationTitles).toHaveText([`「更新した${tag}」に招待されています`, `「${newer.name}」に招待されています`])
  })

  test('「承認」を押すと、メンバー（編集者）になり、通知を消してプロジェクトの一覧に加える', { tag: ['@TC-PG-PLIST-INV3'] }, async ({ owner, ownerApi, project, newAccount, pageAs, ownerPage }) => {
    const invited = await newAccount({ suffix: 'invited' })
    await ownerApi.invite(project.id, invited.username!)
    const page = await pageAs(invited)
    const list = new ProjectListPage(page)
    await list.open()
    await expect(list.row(project.name)).toHaveCount(0)

    await list.acceptButton(project.name).click()

    await expect(list.invitation(project.name)).toHaveCount(0)
    await expect(list.row(project.name)).toBeVisible()
    await expect(list.cell(project.name, 'owner')).toHaveText(owner.name)
    // 編集者として、プロジェクトを開ける
    await list.detailButton(project.name).click()
    await expect(page).toHaveURL(`/projects/${project.id}`)
    // オーナーのユーザー管理では、招待中ではなくなる
    const screens = new ProjectScreens(ownerPage)
    await screens.open(ProjectScreens.paths(project.id).settingsUsers)
    await expect(screens.userCell(invited.username!, 'status')).toHaveText('')
    await expect(screens.userCell(invited.username!, 'role')).toHaveText('')
  })

  test('「拒否」を押すと、招待を取り消し、通知を消す', { tag: ['@TC-PG-PLIST-INV4'] }, async ({ ownerApi, project, newAccount, pageAs, ownerPage }) => {
    const invited = await newAccount({ suffix: 'invited' })
    await ownerApi.invite(project.id, invited.username!)
    const list = new ProjectListPage(await pageAs(invited))
    await list.open()

    await list.denyButton(project.name).click()

    await expect(list.invitation(project.name)).toHaveCount(0)
    await expect(list.row(project.name)).toHaveCount(0)
    await list.open()
    await expect(list.invitation(project.name)).toHaveCount(0)
    // オーナーのユーザー管理からも消える
    const screens = new ProjectScreens(ownerPage)
    await screens.open(ProjectScreens.paths(project.id).settingsUsers)
    await expect(screens.inviteInput).toBeVisible()
    await expect(screens.userRow(invited.username!)).toHaveCount(0)
  })
})

test.describe('プロジェクトの一覧', () => {
  test('メンバーになっているプロジェクトを表示し、招待中のプロジェクトは表示しない', { tag: ['@TC-PG-PLIST-LIST1', '@TC-PG-PLIST-LIST2'] }, async ({ ownerApi, newAccount, apiAs, pageAs, tag }) => {
    const member = await newAccount({ suffix: 'member' })
    const memberApi = await apiAs(member)
    const own = await memberApi.createProject(`自分の${tag}`)
    const joined = await ownerApi.createProject(`参加した${tag}`)
    const invited = await ownerApi.createProject(`招待中の${tag}`)
    await ownerApi.createProject(`無関係の${tag}`)
    await ownerApi.invite(joined.id, member.username!)
    await memberApi.accept(joined.id, member.id)
    await ownerApi.invite(invited.id, member.username!)

    const list = new ProjectListPage(await pageAs(member))
    await list.open()

    // 同じ秒に作ったので、2 件の間の順は問わない
    await expect(list.rows).toHaveCount(2)
    await expect(list.row(joined.name)).toBeVisible()
    await expect(list.row(own.name)).toBeVisible()
    await expect(list.row(invited.name)).toHaveCount(0)
    await expect(list.invitation(invited.name)).toBeVisible()
  })

  test('最終更新日時の新しい順に並べ、最終更新日時はプロジェクトや項目・カードの変更で新しくなる', { tag: ['@TC-PG-PLIST-LIST1', '@TC-PG-PLIST-LIST5'] }, async ({ ownerPage, ownerApi, tag }) => {
    const list = new ProjectListPage(ownerPage)
    const a = await ownerApi.createProject(`A${tag}`)
    const first = await ownerApi.addCard(a.id, { みだし: '前' })
    const second = await ownerApi.addCard(a.id)
    await nextSecond()
    const b = await ownerApi.createProject(`B${tag}`)
    const bCard = await ownerApi.addCard(b.id)
    const order = async (names: string[]) => {
      await list.open()
      await expect(list.projectNames).toHaveText(names)
    }

    // プロジェクトの作成
    await order([b.name, a.name])

    // カードの内容の変更
    await nextSecond()
    const [field] = await ownerApi.fields(a.id)
    await ownerApi.call('put', `/api/projects/${a.id}/cards/${first.id}/fields/${field.id}`, { body: '後' })
    await order([a.name, b.name])

    // プロジェクト名の変更
    await nextSecond()
    await ownerApi.call('put', `/api/projects/${b.id}`, { name: `B2${tag}` })
    await order([`B2${tag}`, a.name])

    // 並び順の変更
    await nextSecond()
    await ownerApi.call('put', `/api/projects/${a.id}/cards`, [{ id: first.id, order: 2 }, { id: second.id, order: 1 }])
    await order([a.name, `B2${tag}`])

    // 項目の追加
    await nextSecond()
    await ownerApi.addField(b.id, `項目${tag}`)
    await order([`B2${tag}`, a.name])

    // カードの削除
    await nextSecond()
    await ownerApi.call('delete', `/api/projects/${a.id}/cards/${second.id}`)
    await order([a.name, `B2${tag}`])

    // カードの複製
    await nextSecond()
    await ownerApi.call('post', `/api/projects/${b.id}/cards/duplicate`, { cardId: [bCard.id], toProjectId: b.id })
    await order([`B2${tag}`, a.name])
  })

  test('【既知の問題】空のカードを追加しても、最終更新日時は新しくならない（あるべき: カードの追加で新しくなる）', { annotation: [knownIssue('docs/ISSUES.md', 'カードを追加しても最終更新日時が変わらない')] }, async ({ ownerPage, ownerApi, tag }) => {
    const list = new ProjectListPage(ownerPage)
    const a = await ownerApi.createProject(`A${tag}`)
    const card = await ownerApi.addCard(a.id)
    await nextSecond()
    const b = await ownerApi.createProject(`B${tag}`)
    await list.open()
    await expect(list.projectNames).toHaveText([b.name, a.name])
    const before = await list.cell(a.name, 'updatedAt').textContent()

    // 末尾への追加と、直下への追加（テーブルビューの「追加」「直下に追加」と同じ API）
    await nextSecond()
    await ownerApi.call('post', `/api/projects/${a.id}/cards`, {})
    await ownerApi.call('post', `/api/projects/${a.id}/cards`, { nextToId: card.id })

    await list.open()
    await expect(list.projectNames).toHaveText([b.name, a.name])
    await expect(list.cell(a.name, 'updatedAt')).toHaveText(before!)
  })

  test('「プロジェクト名」「オーナー」「最終更新日時」の列と、見出しの無い「詳細」ボタンの列を表示し、オーナーの名前を表示する', { tag: ['@TC-PG-PLIST-LIST3', '@TC-PG-PLIST-LIST4', '@TC-FT-ROLES-GEN1'] }, async ({ owner, ownerApi, project, newAccount, apiAs, pageAs }) => {
    const editor = await newAccount({ suffix: 'editor' })
    const editorApi = await apiAs(editor)
    await ownerApi.invite(project.id, editor.username!)
    await editorApi.accept(project.id, editor.id)

    const list = new ProjectListPage(await pageAs(editor))
    await list.open()

    await expect(list.columnHeaders).toHaveText(['', 'プロジェクト名', 'オーナー', '最終更新日時'])
    await expect(list.cell(project.name, 'view')).toHaveText('詳細')
    await expect(list.cell(project.name, 'name')).toHaveText(project.name)
    // 編集者の一覧でも、オーナーの名前を表示する
    await expect(list.cell(project.name, 'owner')).toHaveText(owner.name)
    await expect(list.cell(project.name, 'updatedAt')).toHaveText(/^\d{4}\/\d{1,2}\/\d{1,2} \d{1,2}:\d{2}:\d{2}$/)
  })

  test('メンバーになっているプロジェクトが無い場合、一覧に「No items.」と表示する', { tag: ['@TC-PG-PLIST-LIST7'] }, async ({ ownerPage }) => {
    const list = new ProjectListPage(ownerPage)
    await list.open()

    await expect(list.emptyMessage).toBeVisible()
    await expect(list.rows).toHaveText(['No items.'])
  })

  test('「詳細」を押すと、そのプロジェクトのテーブルビューに遷移する', { tag: ['@TC-PG-PLIST-LIST8'] }, async ({ ownerPage, project }) => {
    const list = new ProjectListPage(ownerPage)
    await list.open()

    await list.detailButton(project.name).click()

    await expect(ownerPage).toHaveURL(`/projects/${project.id}`)
    await expect(new ProjectScreens(ownerPage).projectNameInput).toHaveValue(project.name)
  })

  test('【既知の問題】オーナーがユーザーデータを削除したプロジェクトの編集者は、一覧がエラー画面（500）になる（あるべき: 一覧を表示できる）', { annotation: [knownIssue('docs/ISSUES.md', 'ユーザーを削除してもオーナーのプロジェクトが残る')] }, async ({ ownerPage, ownerApi, project, newAccount, apiAs, pageAs }) => {
    const editor = await newAccount({ suffix: 'editor' })
    await ownerApi.invite(project.id, editor.username!)
    await (await apiAs(editor)).accept(project.id, editor.id)
    const form = new UserFormPage(ownerPage)
    await form.openEdit()
    await form.deleteUser('accept')
    await expect(ownerPage).toHaveURL('/login')

    const page = await pageAs(editor)
    const response = await page.goto('/')

    expect(response?.status()).toBe(500)
    await expect(new ProjectScreens(page).layout.errorCode(500)).toBeVisible()
  })
})

test.describe('新規プロジェクト', () => {
  test('「新規プロジェクト」を押すと、「空白のプロジェクト」「ファイルをインポート」のメニューを開く', { tag: ['@TC-PG-PLIST-NEW1', '@TC-PG-PLIST-NEW3'] }, async ({ ownerPage }) => {
    const list = new ProjectListPage(ownerPage)
    await list.open()
    await expect(list.newProjectButton).toBeVisible()

    await list.newProjectButton.click()

    await expect(list.layout.menuItems).toHaveText(['空白のプロジェクト', 'ファイルをインポート'])
  })

  test('「空白のプロジェクト」を選ぶと、「無題のプロジェクト」を作成してテーブルビューに遷移する', { tag: ['@TC-PG-PLIST-NEW4', '@TC-PG-PLIST-NEW5', '@TC-PG-PLIST-NEW6'] }, async ({ ownerPage, owner }) => {
    const list = new ProjectListPage(ownerPage)
    await list.open()

    await list.newProjectButton.click()
    await list.blankProjectItem.click()

    await expect(ownerPage).toHaveURL(/\/projects\/\d+$/)
    const screens = new ProjectScreens(ownerPage)
    await expect(screens.projectNameInput).toHaveValue('無題のプロジェクト')
    await expect(screens.tableColumnNames).toHaveText(['並び順', 'ID', 'みだし', 'メモ'])
    await expect(screens.tableRows).toHaveCount(0)

    // 作成したユーザーがオーナー
    await list.open()
    await expect(list.cell('無題のプロジェクト', 'owner')).toHaveText(owner.name)
    const projectId = Number(new URL(await list.detailButton('無題のプロジェクト').evaluate((a) => (a as HTMLAnchorElement).href)).pathname.split('/').pop())
    await screens.open(ProjectScreens.paths(projectId).settingsUsers)
    await expect(screens.userCell(owner.username!, 'role')).toHaveText('管理者')
  })

  test('「ファイルをインポート」を選ぶと、「インポート」のダイアログを開く（「同じIDのカードを上書きする」は無い）', { tag: ['@TC-PG-PLIST-NEW7', '@TC-PG-PLIST-NEW8'] }, async ({ ownerPage }) => {
    const list = new ProjectListPage(ownerPage)
    await list.open()

    await list.newProjectButton.click()
    await list.importItem.click()

    await expect(list.importDialog).toBeVisible()
    await expect(list.importDialog.getByText('インポート', { exact: true }).first()).toBeVisible()
    await expect(list.chooseFileButton).toBeVisible()
    await expect(list.importDialog.getByText('xlsx,csv,zipファイルのいずれか（600MBまで）を選択してください')).toBeVisible()
    await expect(list.importButton).toBeDisabled()
    await expect(list.overwriteCheckbox).toHaveCount(0)
  })
})

test.describe('ユーザーストーリー', () => {
  test('研究者は一覧で、自分のプロジェクトと参加したプロジェクトだけをオーナー名で見分け、「詳細」から目的のプロジェクトに移る', { tag: ['@story', '@TC-PG-PLIST-US1'] }, async ({ owner, ownerApi, project, newAccount, apiAs, pageAs, tag }) => {
    // 研究者は、自分のプロジェクトを持ち、他の研究者（owner）のプロジェクトに参加している。別のプロジェクトには招待中で、無関係のプロジェクトもある
    const researcher = await newAccount({ suffix: 'researcher' })
    const researcherApi = await apiAs(researcher)
    const own = await researcherApi.createProject(`自分の${tag}`)
    await ownerApi.invite(project.id, researcher.username!)
    await researcherApi.accept(project.id, researcher.id)
    const invited = await ownerApi.createProject(`招待中の${tag}`)
    await ownerApi.invite(invited.id, researcher.username!)
    const unrelated = await ownerApi.createProject(`無関係の${tag}`)

    const page = await pageAs(researcher)
    const list = new ProjectListPage(page)
    await list.open()

    // 閲覧できるプロジェクトだけを並べ、オーナー名で自分のものと招待されたものを見分けられる
    await expect(list.rows).toHaveCount(2)
    await expect(list.cell(own.name, 'owner')).toHaveText(researcher.name)
    await expect(list.cell(project.name, 'owner')).toHaveText(owner.name)
    await expect(list.row(invited.name)).toHaveCount(0)
    await expect(list.row(unrelated.name)).toHaveCount(0)

    // 参加したプロジェクトに「詳細」から移る
    await list.detailButton(project.name).click()
    await expect(page).toHaveURL(`/projects/${project.id}`)
    await expect(new ProjectScreens(page).projectNameInput).toHaveValue(project.name)

    // 一覧に戻り、自分のプロジェクトにも移れる
    await list.open()
    await list.detailButton(own.name).click()
    await expect(page).toHaveURL(`/projects/${own.id}`)
    await expect(new ProjectScreens(page).projectNameInput).toHaveValue(own.name)
  })

  test('招待されたユーザーは一覧で招待に気づき、一方を承認して参加し、もう一方を拒否すると、その招待は一覧にもオーナーのユーザー管理にも残らない', { tag: ['@story', '@TC-PG-PLIST-US2'] }, async ({ owner, ownerPage, ownerApi, newAccount, pageAs, tag }) => {
    const wanted = await ownerApi.createProject(`参加する${tag}`)
    const unwanted = await ownerApi.createProject(`参加しない${tag}`)
    const invited = await newAccount({ suffix: 'invited' })
    await ownerApi.invite(wanted.id, invited.username!)
    await ownerApi.invite(unwanted.id, invited.username!)

    // 一覧を開くと、招待に気づく（まだ一覧には無い）
    const page = await pageAs(invited)
    const list = new ProjectListPage(page)
    await list.open()
    await expect(list.invitation(wanted.name)).toBeVisible()
    await expect(list.invitation(unwanted.name)).toBeVisible()
    await expect(list.emptyMessage).toBeVisible()

    // 参加するほうを承認すると、一覧に加わり、開ける
    await list.acceptButton(wanted.name).click()
    await expect(list.invitation(wanted.name)).toHaveCount(0)
    await expect(list.cell(wanted.name, 'owner')).toHaveText(owner.name)

    // 参加しないほうを拒否すると、通知が消え、開き直しても戻らない
    await list.denyButton(unwanted.name).click()
    await expect(list.invitation(unwanted.name)).toHaveCount(0)
    await list.open()
    await expect(list.invitationTitles).toHaveCount(0)
    await expect(list.rows).toHaveCount(1)
    await list.detailButton(wanted.name).click()
    await expect(page).toHaveURL(`/projects/${wanted.id}`)
    await expect(new ProjectScreens(page).projectNameInput).toHaveValue(wanted.name)

    // オーナーのユーザー管理では、承認したほうはメンバーになり、拒否したほうからは消える
    const screens = new ProjectScreens(ownerPage)
    await screens.open(ProjectScreens.paths(wanted.id).settingsUsers)
    await expect(screens.userCell(invited.username!, 'status')).toHaveText('')
    await screens.open(ProjectScreens.paths(unwanted.id).settingsUsers)
    await expect(screens.inviteInput).toBeVisible()
    await expect(screens.userRow(invited.username!)).toHaveCount(0)
  })
})
