import { expect, test } from '../../fixtures'
import { ProjectListPage } from '../../pages/ProjectListPage'
import { ProjectScreens } from '../../pages/ProjectScreens'
import { UserFormPage } from '../../pages/UserFormPage'
import { knownIssue, spec, withIssue } from '../../support/spec'

/** 最終更新日時は秒の単位で記録するので、並び順を確かめる前に次の秒まで待つ */
async function nextSecond() {
  const target = (Math.floor(Date.now() / 1000) + 1) * 1000
  await expect.poll(() => Date.now(), { intervals: [100] }).toBeGreaterThanOrEqual(target)
}

test.describe('ヘッダー', () => {
  test('ロゴと、ログインしているユーザーの名前のボタンを表示する', spec('pages/project-list.md',
    'ヘッダー > ロゴと、ログインしているユーザーの名前のボタンを表示する',
  ), async ({ ownerPage, owner }) => {
    const list = new ProjectListPage(ownerPage)
    await list.open()

    await expect(list.logo).toBeVisible()
    await expect(list.layout.userMenuButton(owner.name)).toBeVisible()
  })

  test('名前のボタンを押すと「設定」「ログアウト」のメニューを開き、「設定」を選ぶと設定（ユーザー）に遷移する', spec('pages/project-list.md',
    'ヘッダー > **WHEN** 名前のボタンを押すと',
    'ヘッダー > **WHEN** 名前のボタンを押すと > **WHEN** 「設定」を選ぶと',
  ), async ({ ownerPage, owner }) => {
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
  test('招待されているプロジェクトごとに通知と「承認」「拒否」を、最終更新日時の新しい順に表示する', spec('pages/project-list.md',
    '招待の通知 > **WHERE** 招待されているプロジェクトがある場合',
    '招待の通知 > **WHERE** 招待されているプロジェクトがある場合 > 最終更新日時の新しいプロジェクトから順に並べる',
  ), async ({ ownerApi, newAccount, pageAs, tag }) => {
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

  test('「承認」を押すと、メンバー（編集者）になり、通知を消してプロジェクトの一覧に加える', spec('pages/project-list.md',
    '招待の通知 > **WHERE** 招待されているプロジェクトがある場合 > **WHEN** 「承認」を押すと',
  ), async ({ owner, ownerApi, project, newAccount, pageAs, ownerPage }) => {
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

  test('「拒否」を押すと、招待を取り消し、通知を消す', spec('pages/project-list.md',
    '招待の通知 > **WHERE** 招待されているプロジェクトがある場合 > **WHEN** 「拒否」を押すと',
  ), async ({ ownerApi, project, newAccount, pageAs, ownerPage }) => {
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
  test('メンバーになっているプロジェクトを表示し、招待中のプロジェクトは表示しない', spec('pages/project-list.md',
    'プロジェクトの一覧 > メンバーになっているプロジェクトを',
    'プロジェクトの一覧 > メンバーになっているプロジェクトを > 招待中のプロジェクトは表示しない',
  ), async ({ ownerApi, newAccount, apiAs, pageAs, tag }) => {
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

  test('最終更新日時の新しい順に並べ、最終更新日時はプロジェクトや項目・カードの変更で新しくなる', spec('pages/project-list.md',
    'プロジェクトの一覧 > メンバーになっているプロジェクトを',
    'プロジェクトの一覧 > 「プロジェクト名」「オーナー」「最終更新日時」の列と > 最終更新日時は',
  ), async ({ ownerPage, ownerApi, tag }) => {
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

  test('【既知の問題】空のカードを追加しても、最終更新日時は新しくならない（あるべき: カードの追加で新しくなる）', withIssue(
    spec('pages/project-list.md', 'プロジェクトの一覧 > 「プロジェクト名」「オーナー」「最終更新日時」の列と > 最終更新日時は'),
    knownIssue('docs/ISSUES.md', 'カードを追加しても最終更新日時が変わらない'),
  ), async ({ ownerPage, ownerApi, tag }) => {
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

  test('「プロジェクト名」「オーナー」「最終更新日時」の列と、見出しの無い「詳細」ボタンの列を表示し、オーナーの名前を表示する', spec('pages/project-list.md',
    'プロジェクトの一覧 > 「プロジェクト名」「オーナー」「最終更新日時」の列と',
    'プロジェクトの一覧 > 「プロジェクト名」「オーナー」「最終更新日時」の列と > 「オーナー」の列には',
    'features/roles.md > オーナー | プロジェクトを作成したユーザー',
  ), async ({ owner, ownerApi, project, newAccount, apiAs, pageAs }) => {
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

  test('メンバーになっているプロジェクトが無い場合、一覧に「No items.」と表示する', spec('pages/project-list.md',
    'プロジェクトの一覧 > **WHERE** メンバーになっているプロジェクトが無い場合',
  ), async ({ ownerPage }) => {
    const list = new ProjectListPage(ownerPage)
    await list.open()

    await expect(list.emptyMessage).toBeVisible()
    await expect(list.rows).toHaveText(['No items.'])
  })

  test('「詳細」を押すと、そのプロジェクトのテーブルビューに遷移する', spec('pages/project-list.md',
    'プロジェクトの一覧 > **WHEN** 「詳細」を押すと',
  ), async ({ ownerPage, project }) => {
    const list = new ProjectListPage(ownerPage)
    await list.open()

    await list.detailButton(project.name).click()

    await expect(ownerPage).toHaveURL(`/projects/${project.id}`)
    await expect(new ProjectScreens(ownerPage).projectNameInput).toHaveValue(project.name)
  })

  test('【既知の問題】オーナーがユーザーデータを削除したプロジェクトの編集者は、一覧がエラー画面（500）になる（あるべき: 一覧を表示できる）', withIssue(
    spec('pages/project-list.md', 'プロジェクトの一覧 > 「プロジェクト名」「オーナー」「最終更新日時」の列と > 「オーナー」の列には'),
    knownIssue('docs/ISSUES.md', 'ユーザーを削除してもオーナーのプロジェクトが残る'),
  ), async ({ ownerPage, ownerApi, project, newAccount, apiAs, pageAs }) => {
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
  test('「新規プロジェクト」を押すと、「空白のプロジェクト」「ファイルをインポート」のメニューを開く', spec('pages/project-list.md',
    '新規プロジェクト > 「新規プロジェクト」ボタンを表示する',
    '新規プロジェクト > **WHEN** 「新規プロジェクト」を押すと',
  ), async ({ ownerPage }) => {
    const list = new ProjectListPage(ownerPage)
    await list.open()
    await expect(list.newProjectButton).toBeVisible()

    await list.newProjectButton.click()

    await expect(list.layout.menuItems).toHaveText(['空白のプロジェクト', 'ファイルをインポート'])
  })

  test('「空白のプロジェクト」を選ぶと、「無題のプロジェクト」を作成してテーブルビューに遷移する', spec('pages/project-list.md',
    '新規プロジェクト > **WHEN** 「空白のプロジェクト」を選ぶと',
    '新規プロジェクト > **WHEN** 「空白のプロジェクト」を選ぶと > 作成したユーザーがオーナーになる',
    '新規プロジェクト > **WHEN** 「空白のプロジェクト」を選ぶと > 項目「みだし」「メモ」を作成する',
  ), async ({ ownerPage, owner }) => {
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

  test('「ファイルをインポート」を選ぶと、「インポート」のダイアログを開く（「同じIDのカードを上書きする」は無い）', spec('pages/project-list.md',
    '新規プロジェクト > **WHEN** 「ファイルをインポート」を選ぶと',
    '新規プロジェクト > **WHEN** 「ファイルをインポート」を選ぶと > ダイアログには',
  ), async ({ ownerPage }) => {
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
