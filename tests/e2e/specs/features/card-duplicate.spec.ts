import { readFileSync } from 'node:fs'
import { request, type Page } from '@playwright/test'
import { expect, test } from '../../fixtures'
import { CardMenu } from '../../pages/components/CardMenu'
import { DuplicatesDialog, DuplicateTargets } from '../../pages/components/DuplicateDialog'
import { icon, TableViewPage } from '../../pages/TableViewPage'
import { SESSION_COOKIE, type Account } from '../../support/db'
import { open } from '../../support/navigation'
import { knownIssue, spec, withIssue } from '../../support/spec'

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
  test('「直下に複製」で、同じ値のカードを元のカードのすぐ下に置き、並び順を 1 から振り直して「複製しました」と表示する（遷移しない）', spec(SPEC,
    '複製の内容 > 複製すると、元のカードと同じ値・同じ画像を持つ新しいカードを作る',
    '複製の内容 > 複製すると > 新しいカードの ID は',
    '複製の内容 > 置く位置は次のとおり',
    '複製の内容 > 直下に複製 | 元のカードのすぐ下',
    '複製した後の画面 > 複製すると「複製しました」と表示し',
    '複製した後の画面 > テーブルビュー | 直下に複製、末尾に複製 | 遷移しない',
    `${TABLE} > カードのメニュー > 直下に複製 | 選んだカードを複製してすぐ下に置き`,
    `${TABLE} > カードのメニュー > 「直下に追加」「直下に複製」では`,
  ), async ({ ownerPage, ownerApi, project }) => {
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

  test('「末尾に複製」で、同じ値のカードをプロジェクトの末尾に置き、「複製しました」と表示する（遷移しない）', spec(SPEC,
    '複製の内容 > 末尾に複製 | プロジェクトの末尾',
    '複製した後の画面 > テーブルビュー | 直下に複製、末尾に複製 | 遷移しない',
    `${TABLE} > カードのメニュー > 末尾に複製 | 選んだカードを複製して末尾に置き`,
  ), async ({ ownerPage, ownerApi, project }) => {
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

  test('【既知の問題】前のカードを削除して並び順が飛んでいると、「直下に複製」したカードが元のカードのすぐ下に入らない（あるべき: すぐ下に入り、並び順を 1 から振り直す）', withIssue(
    spec(SPEC, '複製の内容 > 直下に複製 | 元のカードのすぐ下'),
    knownIssue('docs/ISSUES.md', '並び順が飛んでいると「直下に追加」「直下に複製」がすぐ下に入らない'),
  ), async ({ ownerPage, ownerApi, project }) => {
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

  test('画像は元のカードとは別のファイルとして複製し、元のカードの画像を削除しても複製したカードの画像は残る', spec(SPEC,
    '複製の内容 > 複製すると、元のカードと同じ値・同じ画像を持つ新しいカードを作る',
    '複製の内容 > 複製すると > 画像は、元のカードの画像とは別のファイルとして複製する',
  ), async ({ ownerPage, ownerApi, owner, project }) => {
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
  test('複製先に、メンバーのほかのプロジェクトを更新日時の新しい順に一覧して「新しいプロジェクト」を出し、選ぶと項目を名前で対応づけて末尾に複製し、そのテーブルビューに遷移する', spec(SPEC,
    '別のプロジェクトへの複製 > 複製先には、自分がメンバーになっている',
    '別のプロジェクトへの複製 > 項目は名前で対応づける',
    '別のプロジェクトへの複製 > 項目は名前で対応づける > WHERE 複製先に同じ名前の項目が無い場合',
    '別のプロジェクトへの複製 > 項目は名前で対応づける > WHERE 複製先に同じ名前の項目が無い場合 > 追加した項目は',
    '複製の内容 > 複製すると > 新しいカードの ID は',
    '複製の内容 > 別プロジェクトに複製、選択したカードの複製 | 複製先のプロジェクトの末尾',
    '複製した後の画面 > テーブルビュー | 別プロジェクトに複製',
    `${TABLE} > カードのメニュー > 別プロジェクトに複製 | 複製先のプロジェクトを選ぶダイアログ`,
  ), async ({ ownerPage, ownerApi, owner, project, newAccount, apiAs, tag }) => {
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

  test('インポート中のプロジェクトは「インポート中」と表示し、選べない', spec(SPEC,
    '別のプロジェクトへの複製 > 複製先には > WHERE インポート中のプロジェクトの場合',
  ), async ({ ownerPage, ownerApi, owner, project, tag }) => {
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

  test('【既知の問題】「新しいプロジェクト」を選ぶと「無題のプロジェクト」を作って複製するが、遷移した先のテーブルビューが何も表示しない（あるべき: 作ったプロジェクトのテーブルビューを表示する）', withIssue(
    spec(SPEC,
      '別のプロジェクトへの複製 > WHEN 「新しいプロジェクト」を選ぶと',
      '複製した後の画面 > テーブルビュー | 別プロジェクトに複製',
    ),
    knownIssue('docs/ISSUES.md', '新しいプロジェクトに複製するとプロジェクトを開けない'),
    knownIssue(SPEC, '「新しいプロジェクト」に複製すると、作ったプロジェクトにオーナーが設定されない'),
  ), async ({ ownerPage, ownerApi, project }) => {
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
  test('複製したカードは複製元を覚え、「複製元カードを表示」で複製元のカード入力ビューに遷移する', spec(SPEC,
    '複製の内容 > 複製したカードは、元のカードを「複製元」として覚える',
    '複製元と複製先 > WHERE カードに複製元がある場合',
    `${TABLE} > カードのメニュー > 複製元カードを表示 | 複製元のカードの`,
  ), async ({ ownerPage, ownerApi, project }) => {
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

  test('複製元が別のプロジェクトでも、「複製元カードを表示」で複製元のカード入力ビューに遷移する', spec(SPEC,
    '複製元と複製先 > WHERE カードに複製元がある場合 > 複製元が別のプロジェクトでも遷移する',
  ), async ({ ownerPage, ownerApi, project, tag }) => {
    await ownerApi.addCard(project.id, { みだし: 'a' })
    await ownerApi.addCard(project.id, { みだし: 'b' })
    const target = await ownerApi.createProject(`複製先${tag}`)
    await ownerApi.call('post', `/api/projects/${project.id}/cards/duplicate`, { cardId: [2], toProjectId: target.id })

    const tv = new TableViewPage(ownerPage)
    await tv.open(target.id)
    await new CardMenu(ownerPage, tv.cardMenuButton(1)).choose('複製元カードを表示')
    await expect(ownerPage).toHaveURL(`/projects/${project.id}/cards/2`)
  })

  test('複製元のカードが削除されていると、「複製元カードを表示」を選べない', spec(SPEC,
    '複製元と複製先 > WHERE カードに複製元がある場合 > IF 複製元のカードが削除されている場合',
  ), async ({ ownerPage, ownerApi, project }) => {
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

  test('複製したことがあるカードは、「複製先カードを表示」で「（プロジェクト名） - ID: （ID）」の一覧を開き、選ぶとそのカード入力ビューに遷移する', spec(SPEC,
    '複製元と複製先 > WHERE カードを複製したことがある場合',
    '複製元と複製先 > WHERE カードを複製したことがある場合 > 一覧には',
    '複製元と複製先 > WHERE カードを複製したことがある場合 > WHEN 複製先を選ぶと',
    `${TABLE} > カードのメニュー > 複製先カードを表示 | 複製先のカードを選ぶダイアログ`,
  ), async ({ ownerPage, ownerApi, project, tag }) => {
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
  test('「直下に複製」「末尾に複製」で、複製したカードのカード入力ビューに、並び替えと検索の条件を引き継いで遷移する', spec(SPEC,
    '複製した後の画面 > カード入力ビュー | 直下に複製、末尾に複製',
  ), async ({ ownerPage, ownerApi, project }) => {
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

  test('「別プロジェクトに複製」で既存のプロジェクトを選ぶと、複製したカードのカード入力ビューに遷移する', spec(SPEC,
    '複製した後の画面 > カード入力ビュー | 別プロジェクトに複製',
  ), async ({ ownerPage, ownerApi, project, tag }) => {
    await ownerApi.addCard(project.id, { みだし: 'a' })
    const target = await ownerApi.createProject(`複製先${tag}`)
    await ownerApi.addCard(target.id, { みだし: 't' })
    await open(ownerPage, `/projects/${project.id}/cards/1`)

    await CardMenu.ofCardView(ownerPage).choose('別プロジェクトに複製')
    await DuplicateTargets.dialog(ownerPage).project(target.name).click()
    await expect(ownerPage.getByText('複製しました', { exact: true })).toBeVisible()
    await expect(ownerPage).toHaveURL(`/projects/${target.id}/cards/2`)
  })

  test('【既知の問題】カード入力ビューで「新しいプロジェクト」を選ぶと、遷移した先のカード入力ビューが何も表示しない（あるべき: 複製したカードのカード入力ビューを表示する）', withIssue(
    spec(SPEC, '複製した後の画面 > カード入力ビュー | 別プロジェクトに複製'),
    knownIssue('docs/ISSUES.md', '新しいプロジェクトに複製するとプロジェクトを開けない'),
    knownIssue(SPEC, '「新しいプロジェクト」に複製すると、作ったプロジェクトにオーナーが設定されない'),
  ), async ({ ownerPage, ownerApi, project }) => {
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
