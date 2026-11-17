import { readFileSync } from 'node:fs'
import { request, type Page } from '@playwright/test'
import { expect, test } from '../../fixtures'
import { CardViewPage } from '../../pages/CardViewPage'
import { CardMenu } from '../../pages/components/CardMenu'
import { CardSelection } from '../../pages/components/CardSelection'
import { DuplicatesDialog, DuplicateTargets } from '../../pages/components/DuplicateDialog'
import { ProjectListPage } from '../../pages/ProjectListPage'
import { icon, TableViewPage } from '../../pages/TableViewPage'
import { SESSION_COOKIE, type Account } from '../../support/db'
import { open } from '../../support/navigation'
import { knownIssue } from '../../support/spec'

const SPEC = 'features/card-duplicate.md'
const TABLE = 'pages/table-view.md'
const IMAGE = readFileSync(new URL('../../files/table/image.png', import.meta.url))

/** multipart で製品の API を呼ぶ（画像・インポートのファイル。support/api.ts の ProductApi は JSON だけを送る） */
async function postMultipart(account: Account, path: string, multipart: Record<string, string | { name: string, mimeType: string, buffer: Buffer }>) {
  const context = await request.newContext({
    baseURL: process.env.BASE_URL,
    extraHTTPHeaders: { cookie: `${SESSION_COOKIE}=${account.sessionCookie}` },
  })
  try {
    const response = await context.post(path, { multipart })
    if (!response.ok()) throw new Error(`POST ${path}: ${response.status()} ${await response.text()}`)
    return await response.json()
  } finally {
    await context.dispose()
  }
}

/** カード入力ビューに表示している画像（縮小した画像。役割の名前が無いため src で指す） */
function cardViewImages(page: Page) {
  return page.locator('img[src^="/uploads/thumbs/"]')
}

test.describe('テーブルビューでの複製', () => {
  test('「直下に複製」で、同じ値のカードを元のカードのすぐ下に置き、並び順を 1 から振り直して「複製しました」と表示する（遷移しない）', {
    tag: [
      '@TC-FT-DUP-CONT1',
      '@TC-FT-DUP-CONT2',
      '@TC-FT-DUP-CONT5',
      '@TC-FT-DUP-CONT6',
      '@TC-FT-DUP-AFTR1',
      '@TC-FT-DUP-AFTR2',
      '@TC-PG-TABLE-MENU4',
      '@TC-PG-TABLE-MENU2',
    ],
  }, async ({ ownerPage, ownerApi, project }) => {
    await ownerApi.addCard(project.id, { みだし: 'a', メモ: 'memo-a' })
    await ownerApi.addCard(project.id, { みだし: 'b' })
    await ownerApi.addCard(project.id, { みだし: 'c' })
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)

    await new CardMenu(ownerPage, tv.cardMenuButton(1)).choose('直下に複製')
    await expect(tv.toast('複製しました')).toBeVisible()
    await expect(ownerPage).toHaveURL(`/projects/${project.id}`)
    await expect(tv.idCells).toHaveText(['1', '4', '2', '3'])
    await expect(tv.orderCells).toHaveText(['1', '2', '3', '4'])
    await expect(await tv.cellInput(4, 'みだし')).toHaveValue('a')
    await expect(await tv.cellInput(4, 'メモ')).toHaveValue('memo-a')
  })

  test('「末尾に複製」で、同じ値のカードをプロジェクトの末尾に置き、「複製しました」と表示する（遷移しない）', { tag: ['@TC-FT-DUP-CONT7', '@TC-FT-DUP-AFTR2', '@TC-PG-TABLE-MENU5'] }, async ({ ownerPage, ownerApi, project }) => {
    await ownerApi.addCard(project.id, { みだし: 'a' })
    await ownerApi.addCard(project.id, { みだし: 'b', メモ: 'memo-b' })
    await ownerApi.addCard(project.id, { みだし: 'c' })
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)

    await new CardMenu(ownerPage, tv.cardMenuButton(2)).choose('末尾に複製')
    await expect(tv.toast('複製しました')).toBeVisible()
    await expect(ownerPage).toHaveURL(`/projects/${project.id}`)
    await expect(tv.idCells).toHaveText(['1', '2', '3', '4'])
    await expect(tv.orderCells).toHaveText(['1', '2', '3', '4'])
    await expect(await tv.cellInput(4, 'みだし')).toHaveValue('b')
    await expect(await tv.cellInput(4, 'メモ')).toHaveValue('memo-b')
  })

  test('【既知の問題】前のカードを削除して並び順が飛んでいると、「直下に複製」したカードが元のカードのすぐ下に入らない（あるべき: すぐ下に入り、並び順を 1 から振り直す）', { annotation: [knownIssue('docs/ISSUES.md', '並び順が飛んでいると「直下に追加」「直下に複製」がすぐ下に入らない')] }, async ({ ownerPage, ownerApi, project }) => {
    for (const v of ['a', 'b', 'c', 'd']) await ownerApi.addCard(project.id, { みだし: v })
    await ownerApi.call('delete', `/api/projects/${project.id}/cards`, { ids: [1, 2] })
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)
    await expect(tv.orderCells).toHaveText(['3', '4'])

    await new CardMenu(ownerPage, tv.cardMenuButton(3)).choose('直下に複製')
    await expect(tv.toast('複製しました')).toBeVisible()
    // ID 5（ID 3 の複製）は ID 3 のすぐ下ではなく末尾に入り、並び順が ID 4 と重なる
    await expect(tv.idCells).toHaveText(['3', '4', '5'])
    await expect(tv.orderCells).toHaveText(['1', '3', '3'])
  })

  test('画像は元のカードとは別のファイルとして複製し、元のカードの画像を削除しても複製したカードの画像は残る', { tag: ['@TC-FT-DUP-CONT1', '@TC-FT-DUP-CONT3'] }, async ({ ownerPage, ownerApi, owner, project }) => {
    await ownerApi.addCard(project.id, { みだし: 'a' })
    await postMultipart(owner, `/api/projects/${project.id}/cards/1/images`, {
      image: { name: 'image.png', mimeType: 'image/png', buffer: IMAGE },
    })
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)

    await new CardMenu(ownerPage, tv.cardMenuButton(1)).choose('末尾に複製')
    await expect(tv.toast('複製しました')).toBeVisible()
    await expect(icon(tv.cardInputLink(2), 'photo-library')).toBeVisible()

    // 元のカードの画像を削除する
    const original = await ownerApi.call<{ images: { id: number }[] }>('get', `/api/projects/${project.id}/cards/1`)
    await ownerApi.call('delete', `/api/projects/${project.id}/cards/1/images/${original.images[0].id}`)
    await tv.open(project.id)
    await expect(icon(tv.cardInputLink(1), 'edit-note')).toBeVisible()
    await expect(icon(tv.cardInputLink(2), 'photo-library')).toBeVisible()

    // 複製したカードの画像は表示できる
    await open(ownerPage, `/projects/${project.id}/cards/2`)
    await expect(cardViewImages(ownerPage)).toHaveCount(1)
    await expect.poll(() => cardViewImages(ownerPage).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0)
  })
})

test.describe('別のプロジェクトへの複製', () => {
  test('複製先に、メンバーのほかのプロジェクトを更新日時の新しい順に一覧して「新しいプロジェクト」を出し、選ぶと項目を名前で対応づけて末尾に複製し、そのテーブルビューに遷移する', {
    tag: [
      '@TC-FT-DUP-OTHR1',
      '@TC-FT-DUP-OTHR3',
      '@TC-FT-DUP-OTHR4',
      '@TC-FT-DUP-OTHR5',
      '@TC-FT-DUP-CONT2',
      '@TC-FT-DUP-CONT8',
      '@TC-FT-DUP-AFTR3',
      '@TC-PG-TABLE-MENU6',
    ],
  }, async ({ ownerPage, ownerApi, owner, project, newAccount, apiAs, tag }) => {
    const memo = (await ownerApi.fields(project.id)).find((f) => f.name === 'メモ')!
    await ownerApi.addCard(project.id, { みだし: 'x', メモ: 'y' })
    await ownerApi.setFieldVisible(project.id, memo.id, false)

    // 複製先: 項目「みだし」「分類」で、カードが 2 枚ある
    const older = await ownerApi.createProject(`古い${tag}`, { fields: false })
    await ownerApi.addField(older.id, 'みだし')
    await ownerApi.addField(older.id, '分類')
    await ownerApi.addCard(older.id, { みだし: 'o1' })
    await ownerApi.addCard(older.id, { みだし: 'o2' })
    const newer = await ownerApi.createProject(`新しい${tag}`)
    // 更新日時は秒の単位なので、newer のほうが新しくなるまでプロジェクト名を保存し直す
    await expect.poll(async () => {
      await ownerApi.call('put', `/api/projects/${newer.id}`, { name: newer.name })
      const projects = await ownerApi.call<{ id: number, updatedAt: string }[]>('get', '/api/projects')
      const updatedAt = (id: number) => new Date(projects.find((p) => p.id === id)!.updatedAt).getTime()
      return updatedAt(newer.id) > updatedAt(older.id)
    }, { timeout: 10_000, intervals: [500] }).toBe(true)
    // 招待を受けている途中のプロジェクトは出さない
    const other = await newAccount({ suffix: 'other' })
    const otherApi = await apiAs(other)
    const invited = await otherApi.createProject(`招待中${tag}`)
    await otherApi.invite(invited.id, owner.username!)

    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)
    await new CardMenu(ownerPage, tv.cardMenuButton(1)).choose('別プロジェクトに複製')
    const targets = DuplicateTargets.dialog(ownerPage)
    await expect(targets.options).toHaveText([newer.name, older.name, '新しいプロジェクト'])

    await targets.project(older.name).click()
    await expect(tv.toast('複製しました')).toBeVisible()
    await expect(ownerPage).toHaveURL(`/projects/${older.id}`)
    await expect(tv.idCells).toHaveText(['1', '2', '3'])
    // 複製先に無い「メモ」を末尾に追加し、複製元で非表示でも表示する
    await expect.poll(() => tv.fieldNames()).toEqual(['みだし', '分類', 'メモ'])
    await expect(await tv.cellInput(3, 'みだし')).toHaveValue('x')
    await expect(await tv.cellInput(3, 'メモ')).toHaveValue('y')
    await expect(await tv.cellInput(3, '分類')).toHaveValue('')
  })

  test('インポート中のプロジェクトは「インポート中」と表示し、選べない', { tag: ['@TC-FT-DUP-OTHR2'] }, async ({ ownerPage, ownerApi, owner, project, tag }) => {
    test.setTimeout(120_000)
    await ownerApi.addCard(project.id, { みだし: 'x' })
    const importing = await ownerApi.createProject(`インポート中${tag}`)
    // インポートは毎分 0 秒の定期タスクで取り込まれる。確かめる前に取り込まれないよう、秒が 5〜40 の間に始める
    await expect.poll(() => {
      const seconds = new Date().getSeconds()
      return seconds >= 5 && seconds <= 40
    }, { timeout: 60_000, intervals: [1000] }).toBe(true)
    await postMultipart(owner, `/api/projects/${importing.id}/imports`, {
      file: { name: 'import.csv', mimeType: 'text/csv', buffer: Buffer.from('title\nb\n') },
    })

    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)
    await new CardMenu(ownerPage, tv.cardMenuButton(1)).choose('別プロジェクトに複製')
    const option = DuplicateTargets.dialog(ownerPage).project(importing.name)
    await expect(option).toContainText('インポート中')
    await expect(option).toBeDisabled()
  })

  test('「新しいプロジェクト」を選ぶと、「無題のプロジェクト」という名前のプロジェクトを作り、そこに複製する', { tag: ['@TC-FT-DUP-OTHR6'] }, async ({ ownerPage, ownerApi, project }) => {
    await ownerApi.addCard(project.id, { みだし: 'x' })
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)
    await new CardMenu(ownerPage, tv.cardMenuButton(1)).choose('別プロジェクトに複製')
    await DuplicateTargets.dialog(ownerPage).newProject.click()
    await expect(tv.toast('複製しました')).toBeVisible()
    // 遷移した先は開けない（既知の問題）ので、複製元のカードの複製先から、作ったプロジェクトとカードを確かめる
    await expect(ownerPage).toHaveURL((url) => /^\/projects\/\d+$/.test(url.pathname) && url.pathname !== `/projects/${project.id}`)

    await tv.open(project.id)
    await new CardMenu(ownerPage, tv.cardMenuButton(1)).choose('複製先カードを表示')
    await expect(new DuplicatesDialog(ownerPage).links).toHaveText(['無題のプロジェクト - ID: 1'])
  })

  test('【既知の問題】「新しいプロジェクト」を選ぶと「無題のプロジェクト」を作って複製するが、遷移した先のテーブルビューが何も表示しない（あるべき: 作ったプロジェクトのテーブルビューを表示する）', { annotation: [knownIssue('docs/ISSUES.md', '新しいプロジェクトに複製するとプロジェクトを開けない'), knownIssue(SPEC, '「新しいプロジェクト」に複製すると、作ったプロジェクトにオーナーが設定されない')] }, async ({ ownerPage, ownerApi, project }) => {
    await ownerApi.addCard(project.id, { みだし: 'x' })
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)
    await new CardMenu(ownerPage, tv.cardMenuButton(1)).choose('別プロジェクトに複製')

    const notFound = ownerPage.waitForResponse((r) => /\/api\/projects\/\d+$/.test(r.url()) && r.status() === 404)
    await DuplicateTargets.dialog(ownerPage).newProject.click()
    await expect(tv.toast('複製しました')).toBeVisible()
    // 作ったプロジェクトのテーブルビューに遷移する
    await expect(ownerPage).toHaveURL((url) => /^\/projects\/\d+$/.test(url.pathname) && url.pathname !== `/projects/${project.id}`)
    // プロジェクトを読めず（404）、エラー画面でもなく、何も無い画面になる
    await notFound
    await expect(tv.table).toHaveCount(0)
    await expect(ownerPage.getByRole('link')).toHaveCount(0)

    // 作ったプロジェクトの名前は「無題のプロジェクト」（複製元のカードの複製先として出る）
    await tv.open(project.id)
    await new CardMenu(ownerPage, tv.cardMenuButton(1)).choose('複製先カードを表示')
    await expect(new DuplicatesDialog(ownerPage).links).toHaveText(['無題のプロジェクト - ID: 1'])
  })
})

test.describe('複製元と複製先', () => {
  test('複製したカードは複製元を覚え、「複製元カードを表示」で複製元のカード入力ビューに遷移する', { tag: ['@TC-FT-DUP-CONT4', '@TC-FT-DUP-SRC1', '@TC-PG-TABLE-MENU7'] }, async ({ ownerPage, ownerApi, project }) => {
    await ownerApi.addCard(project.id, { みだし: 'a' })
    await ownerApi.addCard(project.id, { みだし: 'b' })
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)
    await new CardMenu(ownerPage, tv.cardMenuButton(2)).choose('末尾に複製')
    await expect(tv.idCells).toHaveText(['1', '2', '3'])

    const menu = new CardMenu(ownerPage, tv.cardMenuButton(3))
    await menu.open()
    await expect(menu.item('複製元カードを表示')).toBeEnabled()
    await menu.item('複製元カードを表示').click()
    await expect(ownerPage).toHaveURL(`/projects/${project.id}/cards/2`)
  })

  test('複製元が別のプロジェクトでも、「複製元カードを表示」で複製元のカード入力ビューに遷移する', { tag: ['@TC-FT-DUP-SRC2'] }, async ({ ownerPage, ownerApi, project, tag }) => {
    await ownerApi.addCard(project.id, { みだし: 'a' })
    await ownerApi.addCard(project.id, { みだし: 'b' })
    const target = await ownerApi.createProject(`複製先${tag}`)
    await ownerApi.call('post', `/api/projects/${project.id}/cards/duplicate`, { cardId: [2], toProjectId: target.id })

    const tv = new TableViewPage(ownerPage)
    await tv.open(target.id)
    await new CardMenu(ownerPage, tv.cardMenuButton(1)).choose('複製元カードを表示')
    await expect(ownerPage).toHaveURL(`/projects/${project.id}/cards/2`)
  })

  test('【既知の問題】別のプロジェクトのカード入力ビューから「複製元カードを表示」で移ると、カードのメニューが移る前のカードのままになる（あるべき: 移った先のカードのメニューにする）', {
    annotation: [knownIssue('docs/ISSUES.md', '別のプロジェクトのカード入力ビューから移ると、カードのメニューが移る前のカードのままになる')],
  }, async ({ ownerPage, ownerApi, project, tag }) => {
    // 複製元（複製先がある・複製元が無い）と、別のプロジェクトの複製（複製元がある・複製先が無い）
    await ownerApi.addCard(project.id, { みだし: '複製元' })
    const target = await ownerApi.createProject(`複製先${tag}`)
    await ownerApi.call('post', `/api/projects/${project.id}/cards/duplicate`, { cardId: [1], toProjectId: target.id })

    const view = new CardViewPage(ownerPage)
    await open(ownerPage, `/projects/${target.id}/cards/1`)
    await view.openMenu()
    await view.menuItem('複製元カードを表示').click()
    await expect(ownerPage).toHaveURL(`/projects/${project.id}/cards/1`)
    await expect(view.field('みだし')).toHaveValue('複製元')

    // 値は移った先のカードだが、メニューは移る前の複製のまま
    await view.openMenu()
    await expect(view.menuItem('複製元カードを表示')).toBeEnabled()
    await expect(view.menuItem('複製先カードを表示')).toBeDisabled()
    await ownerPage.keyboard.press('Escape')

    // 読み込み直すと、移った先のカードのメニューになる
    await open(ownerPage, `/projects/${project.id}/cards/1`)
    await view.openMenu()
    await expect(view.menuItem('複製元カードを表示')).toBeDisabled()
    await expect(view.menuItem('複製先カードを表示')).toBeEnabled()
  })

  test('複製元のカードが削除されていると、「複製元カードを表示」を選べない', { tag: ['@TC-FT-DUP-SRC3'] }, async ({ ownerPage, ownerApi, project }) => {
    await ownerApi.addCard(project.id, { みだし: 'a' })
    await ownerApi.call('post', `/api/projects/${project.id}/cards/duplicate`, { cardId: [1], toProjectId: project.id })
    await ownerApi.call('delete', `/api/projects/${project.id}/cards/1`)

    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)
    await expect(tv.idCells).toHaveText(['2'])
    const menu = new CardMenu(ownerPage, tv.cardMenuButton(2))
    await menu.open()
    await expect(menu.item('複製元カードを表示')).toBeDisabled()
  })

  test('複製したことがあるカードは、「複製先カードを表示」で「（プロジェクト名） - ID: （ID）」の一覧を開き、選ぶとそのカード入力ビューに遷移する', { tag: ['@TC-FT-DUP-SRC4', '@TC-FT-DUP-SRC5', '@TC-FT-DUP-SRC6', '@TC-PG-TABLE-MENU8'] }, async ({ ownerPage, ownerApi, project, tag }) => {
    await ownerApi.addCard(project.id, { みだし: 'a' })
    const target = await ownerApi.createProject(`複製先${tag}`)
    await ownerApi.addCard(target.id, { みだし: 't' })
    await ownerApi.call('post', `/api/projects/${project.id}/cards/duplicate`, { cardId: [1], toProjectId: project.id })
    await ownerApi.call('post', `/api/projects/${project.id}/cards/duplicate`, { cardId: [1], toProjectId: target.id })

    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)
    const menu = new CardMenu(ownerPage, tv.cardMenuButton(1))
    await menu.open()
    await expect(menu.item('複製先カードを表示')).toBeEnabled()
    await menu.item('複製先カードを表示').click()

    const dialog = new DuplicatesDialog(ownerPage)
    await expect(dialog.links).toHaveCount(2)
    await expect(dialog.link(`${project.name} - ID: 2`)).toBeVisible()
    await expect(dialog.link(`${target.name} - ID: 2`)).toBeVisible()

    await dialog.link(`${target.name} - ID: 2`).click()
    await expect(ownerPage).toHaveURL(`/projects/${target.id}/cards/2`)
  })
})

test.describe('カード入力ビューでの複製', () => {
  test('「直下に複製」「末尾に複製」で、複製したカードのカード入力ビューに、並び替えと検索の条件を引き継いで遷移する', { tag: ['@TC-FT-DUP-AFTR4'] }, async ({ ownerPage, ownerApi, project }) => {
    await ownerApi.addCard(project.id, { みだし: 'apple' })
    await ownerApi.addCard(project.id, { みだし: 'apricot' })
    const query = '?q=ap&sort=id&direction=desc'
    await open(ownerPage, `/projects/${project.id}/cards/1${query}`)

    await CardMenu.ofCardView(ownerPage).choose('直下に複製')
    await expect(ownerPage.getByText('複製しました', { exact: true })).toBeVisible()
    await expect(ownerPage).toHaveURL(`/projects/${project.id}/cards/3${query}`)

    await CardMenu.ofCardView(ownerPage).choose('末尾に複製')
    await expect(ownerPage).toHaveURL(`/projects/${project.id}/cards/4${query}`)

    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)
    await expect(tv.idCells).toHaveText(['1', '3', '2', '4'])
  })

  test('「別プロジェクトに複製」で既存のプロジェクトを選ぶと、複製したカードのカード入力ビューに遷移する', { tag: ['@TC-FT-DUP-AFTR5'] }, async ({ ownerPage, ownerApi, project, tag }) => {
    await ownerApi.addCard(project.id, { みだし: 'a' })
    const target = await ownerApi.createProject(`複製先${tag}`)
    await ownerApi.addCard(target.id, { みだし: 't' })
    await open(ownerPage, `/projects/${project.id}/cards/1`)

    await CardMenu.ofCardView(ownerPage).choose('別プロジェクトに複製')
    await DuplicateTargets.dialog(ownerPage).project(target.name).click()
    await expect(ownerPage.getByText('複製しました', { exact: true })).toBeVisible()
    await expect(ownerPage).toHaveURL(`/projects/${target.id}/cards/2`)
  })

  test('【既知の問題】カード入力ビューで「新しいプロジェクト」を選ぶと、遷移した先のカード入力ビューが何も表示しない（あるべき: 複製したカードのカード入力ビューを表示する）', { annotation: [knownIssue('docs/ISSUES.md', '新しいプロジェクトに複製するとプロジェクトを開けない'), knownIssue(SPEC, '「新しいプロジェクト」に複製すると、作ったプロジェクトにオーナーが設定されない')] }, async ({ ownerPage, ownerApi, project }) => {
    await ownerApi.addCard(project.id, { みだし: 'a' })
    await open(ownerPage, `/projects/${project.id}/cards/1`)

    const notFound = ownerPage.waitForResponse((r) => /\/api\/projects\/\d+$/.test(r.url()) && r.status() === 404)
    await CardMenu.ofCardView(ownerPage).choose('別プロジェクトに複製')
    await DuplicateTargets.dialog(ownerPage).newProject.click()
    await expect(ownerPage.getByText('複製しました', { exact: true })).toBeVisible()
    // 作ったプロジェクトの、複製したカード（ID 1）のカード入力ビューに遷移する
    await expect(ownerPage).toHaveURL((url) => /^\/projects\/\d+\/cards\/1$/.test(url.pathname) && !url.pathname.startsWith(`/projects/${project.id}/`))
    await notFound
    await expect(ownerPage.getByRole('link')).toHaveCount(0)
    await expect(ownerPage.getByRole('textbox')).toHaveCount(0)
  })
})

/** セルを押して入力欄を開き、値を書き換え、入力欄の外を押して保存を待つ */
async function rewriteCell(tv: TableViewPage, cardId: number, fieldName: string, fieldId: number, value: string) {
  const saved = tv.waitForCellSave(cardId, fieldId, value)
  await (await tv.cellInput(cardId, fieldName)).click()
  await tv.activeCellEditor.fill(value)
  await tv.countText.click()
  await saved
}

test.describe('ユーザーストーリー', () => {
  test('研究者が、値を入れたカードを「直下に複製」し、違う「みだし」だけを書き換えることを繰り返して、同じ「メモ」を打ち直さずに似たカードを続けて作る', { tag: ['@story', '@TC-FT-DUP-US1'] }, async ({ ownerPage, ownerApi, project }) => {
    const midashi = (await ownerApi.fields(project.id)).find((f) => f.name === 'みだし')!.id
    await ownerApi.addCard(project.id, { みだし: '土器 口縁部', メモ: 'A区 第1層 縄文時代中期' })
    await ownerApi.addCard(project.id, { みだし: '石器', メモ: 'B区' })
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)

    // 1 枚目を複製し、すぐ下にできたカードの「みだし」だけを書き換える
    await new CardMenu(ownerPage, tv.cardMenuButton(1)).choose('直下に複製')
    await expect(tv.toast('複製しました')).toBeVisible()
    await expect(tv.idCells).toHaveText(['1', '3', '2'])
    await expect(await tv.cellInput(3, 'メモ')).toHaveValue('A区 第1層 縄文時代中期')
    await rewriteCell(tv, 3, 'みだし', midashi, '土器 胴部')

    // 書き換えたカードをさらに複製し、「みだし」だけを書き換える
    await new CardMenu(ownerPage, tv.cardMenuButton(3)).choose('直下に複製')
    await expect(tv.idCells).toHaveText(['1', '3', '4', '2'])
    await expect(await tv.cellInput(4, 'みだし')).toHaveValue('土器 胴部')
    await rewriteCell(tv, 4, 'みだし', midashi, '土器 底部')

    // 開き直すと、似たカードが続けて並び、「メモ」は打ち直さずに同じ値を持つ。元のカードは変わらない
    await tv.open(project.id)
    await expect(tv.idCells).toHaveText(['1', '3', '4', '2'])
    await expect(tv.orderCells).toHaveText(['1', '2', '3', '4'])
    const expected: [number, string][] = [[1, '土器 口縁部'], [3, '土器 胴部'], [4, '土器 底部']]
    for (const [id, value] of expected) {
      await expect(await tv.cellInput(id, 'みだし')).toHaveValue(value)
      await expect(await tv.cellInput(id, 'メモ')).toHaveValue('A区 第1層 縄文時代中期')
    }
    await expect(await tv.cellInput(2, 'みだし')).toHaveValue('石器')
  })

  test('研究者が、空白のプロジェクトを作って名前を付け、元のプロジェクトから選んだカード群をそこへ複製して、再編したカード群のプロジェクトを作る', { tag: ['@story', '@TC-FT-DUP-US2'] }, async ({ ownerPage, ownerApi, project, tag }) => {
    // 元のプロジェクトには、新しいプロジェクトに無い項目「出土地点」がある
    await ownerApi.addField(project.id, '出土地点')
    await ownerApi.addCard(project.id, { みだし: '土器 口縁部', 出土地点: 'A区' })
    await ownerApi.addCard(project.id, { みだし: '石器', 出土地点: 'B区' })
    await ownerApi.addCard(project.id, { みだし: '土器 胴部', 出土地点: 'A区' })
    await ownerApi.addCard(project.id, { みだし: '骨片', 出土地点: 'C区' })
    const name = `A区とC区の遺物${tag}`

    // プロジェクト一覧で空白のプロジェクトを作り、名前を付ける
    const list = new ProjectListPage(ownerPage)
    await list.open()
    await list.newProjectButton.click()
    await list.blankProjectItem.click()
    await expect(ownerPage).toHaveURL(/\/projects\/\d+$/)
    const newId = Number(new URL(ownerPage.url()).pathname.split('/').pop())
    const tv = new TableViewPage(ownerPage)
    await expect(tv.projectNameInput).toHaveValue('無題のプロジェクト')
    const renamed = ownerPage.waitForResponse((r) => r.request().method() === 'PUT' && new URL(r.url()).pathname === `/api/projects/${newId}`)
    await tv.projectNameInput.fill(name)
    await renamed

    // 元のプロジェクトで「A区」のカードを絞り込んでまとめて選び、作ったプロジェクトへ複製する
    const selection = new CardSelection(ownerPage)
    await tv.open(project.id)
    await tv.search('A区')
    await expect(tv.idCells).toHaveText(['1', '3'])
    await tv.headerCheckbox.check()
    await selection.duplicateButton.click()
    await DuplicateTargets.popover(ownerPage).project(name).click()
    await expect(tv.toast('複製しました')).toBeVisible()
    await expect(ownerPage).toHaveURL(`/projects/${newId}`)
    await expect(tv.idCells).toHaveText(['1', '2'])

    // 元のプロジェクトに戻り、「C区」のカードを 1 枚だけ、カードのメニューから同じプロジェクトへ複製する
    await tv.open(project.id)
    await new CardMenu(ownerPage, tv.cardMenuButton(4)).choose('別プロジェクトに複製')
    await DuplicateTargets.dialog(ownerPage).project(name).click()
    await expect(ownerPage).toHaveURL(`/projects/${newId}`)
    await expect(tv.idCells).toHaveText(['1', '2', '3'])

    // 作ったプロジェクトは、再編したカード群を元の値のまま持ち、無かった項目も足されている
    await tv.open(newId)
    await expect(tv.projectNameInput).toHaveValue(name)
    await expect.poll(() => tv.fieldNames()).toEqual(['みだし', 'メモ', '出土地点'])
    const expected: [number, string, string][] = [[1, '土器 口縁部', 'A区'], [2, '土器 胴部', 'A区'], [3, '骨片', 'C区']]
    for (const [id, midashi, place] of expected) {
      await expect(await tv.cellInput(id, 'みだし')).toHaveValue(midashi)
      await expect(await tv.cellInput(id, '出土地点')).toHaveValue(place)
    }

    // プロジェクト一覧にも並ぶ。元のプロジェクトのカードは減っていない
    await list.open()
    await expect(list.row(name)).toBeVisible()
    await tv.open(project.id)
    await expect(tv.countText).toHaveText('全 4 件')
  })

  test('研究者が、同じプロジェクトと別のプロジェクトに複製して書き換えたカードを、複製元と複製先をたどって行き来し、それぞれの違いを確かめる', { tag: ['@story', '@TC-FT-DUP-US3'] }, async ({ ownerPage, ownerApi, project, tag }) => {
    const other = await ownerApi.createProject(`別の調査${tag}`)
    await ownerApi.addCard(other.id, { みだし: '既存のカード' })
    const memoHere = (await ownerApi.fields(project.id)).find((f) => f.name === 'メモ')!.id
    const memoOther = (await ownerApi.fields(other.id)).find((f) => f.name === 'メモ')!.id
    await ownerApi.addCard(project.id, { みだし: '土器', メモ: '口縁部と胴部が接合' })
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)

    // 同じプロジェクトの末尾に複製し、複製したカードの「メモ」を書き換える
    await new CardMenu(ownerPage, tv.cardMenuButton(1)).choose('末尾に複製')
    await expect(tv.idCells).toHaveText(['1', '2'])
    await rewriteCell(tv, 2, 'メモ', memoHere, '口縁部のみ')

    // 別のプロジェクトにも複製し、複製したカードの「メモ」を書き換える
    await new CardMenu(ownerPage, tv.cardMenuButton(1)).choose('別プロジェクトに複製')
    await DuplicateTargets.dialog(ownerPage).project(other.name).click()
    await expect(ownerPage).toHaveURL(`/projects/${other.id}`)
    await expect(tv.idCells).toHaveText(['1', '2'])
    await rewriteCell(tv, 2, 'メモ', memoOther, '胴部のみ')

    // 別のプロジェクトの複製から、複製元のカードをたどる。複製元は書き換える前の値のまま
    await new CardMenu(ownerPage, tv.cardMenuButton(2)).choose('複製元カードを表示')
    await expect(ownerPage).toHaveURL(`/projects/${project.id}/cards/1`)
    const view = new CardViewPage(ownerPage)
    await expect(view.field('メモ')).toHaveValue('口縁部と胴部が接合')

    // 複製元から、複製先の一覧をたどる。別のプロジェクトの複製は書き換えた値になっている
    await view.openMenu()
    await view.menuItem('複製先カードを表示').click()
    const duplicates = view.dialog('複製先カード')
    await expect(duplicates.getByRole('link')).toHaveCount(2)
    await duplicates.getByText(`${other.name} - ID: 2`, { exact: true }).click()
    await expect(ownerPage).toHaveURL(`/projects/${other.id}/cards/2`)
    await expect(view.field('メモ')).toHaveValue('胴部のみ')

    // もう一度複製元に戻り、同じプロジェクトの複製をたどる
    await view.openMenu()
    await view.menuItem('複製元カードを表示').click()
    await expect(ownerPage).toHaveURL(`/projects/${project.id}/cards/1`)
    // 別のプロジェクトのカード入力ビューから移ると、カードのメニューが移る前のカードのままになる（docs/ISSUES.md「別のプロジェクトのカード入力ビューから移ると、カードのメニューが移る前のカードのままになる」）。
    // 読み込み直して避ける
    await expect(view.field('みだし')).toHaveValue('土器')
    await open(ownerPage, `/projects/${project.id}/cards/1`)
    await view.openMenu()
    await view.menuItem('複製先カードを表示').click()
    await view.dialog('複製先カード').getByText(`${project.name} - ID: 2`, { exact: true }).click()
    await expect(ownerPage).toHaveURL(`/projects/${project.id}/cards/2`)
    await expect(view.field('メモ')).toHaveValue('口縁部のみ')
    await expect(view.field('みだし')).toHaveValue('土器')
  })
})
