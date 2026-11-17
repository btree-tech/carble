import { readFileSync } from 'node:fs'
import { request, type Page } from '@playwright/test'
import { expect, test } from '../../fixtures'
import { CardMenu } from '../../pages/components/CardMenu'
import { GridSelection } from '../../pages/components/CardSelection'
import { dragWithMouse, TableViewPage } from '../../pages/TableViewPage'
import { SESSION_COOKIE, type Account } from '../../support/db'
import { open } from '../../support/navigation'
import { knownIssue, spec, withIssue } from '../../support/spec'

const SPEC = 'pages/table-view.md'
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

/**
 * インポートは毎分 0 秒の定期タスクで取り込まれる。
 * 「インポート中」の画面を確かめる前に取り込まれてしまわないよう、秒が 5〜40 の間になるまで待つ
 */
async function avoidImportTask() {
  await expect.poll(() => {
    const seconds = new Date().getSeconds()
    return seconds >= 5 && seconds <= 40
  }, { timeout: 60_000, intervals: [1000] }).toBe(true)
}

/** 保存の要求（PUT）を待ち、最後の入力からの経過ミリ秒を返す */
async function waitForPut(page: Page, path: RegExp, since: () => number) {
  const req = await page.waitForRequest((r) => r.method() === 'PUT' && path.test(new URL(r.url()).pathname))
  const elapsed = Date.now() - since()
  await req.response()
  return elapsed
}

test.describe('ヘッダー', () => {
  test('「ホーム」、プロジェクト名、「スキャン」、各ビューのボタン、検索の入力欄を表示する', spec(SPEC,
    'ヘッダー > 「ホーム」リンク、プロジェクト名の入力欄、「スキャン」ボタンを表示する',
    'ヘッダー > 「ホーム」リンク、プロジェクト名の入力欄、「スキャン」ボタンを表示する > 「スキャン」は',
    'ヘッダー > 「グリッドビュー」「カード印刷ビュー」「プロジェクト設定」ボタンと',
  ), async ({ ownerPage, project }) => {
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)

    await expect(tv.homeLink).toHaveAccessibleName('ホーム')
    await expect(tv.projectNameInput).toHaveValue(project.name)
    await expect(tv.scanButton).toBeVisible()
    await expect(tv.gridViewLink).toHaveAccessibleName('グリッドビュー')
    await expect(tv.printViewLink).toHaveAccessibleName('カード印刷ビュー')
    await expect(tv.settingsLink).toHaveAccessibleName('プロジェクト設定')
    await expect(tv.searchInput).toBeVisible()
  })

  test('「ホーム」を押すとプロジェクト一覧に遷移する', spec(SPEC,
    'ヘッダー > 「ホーム」リンク > WHEN 「ホーム」を押すと',
  ), async ({ ownerPage, project }) => {
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)
    await tv.homeLink.click()
    await expect(ownerPage).toHaveURL('/')
  })

  test('プロジェクト名を変更すると、入力が止まってから 1 秒後に保存し、保存状態のアイコンを表示する', spec(SPEC,
    'ヘッダー > 「ホーム」リンク > WHEN プロジェクト名を変更すると',
    'ヘッダー > 「グリッドビュー」「カード印刷ビュー」 > 保存状態のアイコンは',
  ), async ({ ownerPage, project, tag }) => {
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)

    let lastInput = 0
    const put = waitForPut(ownerPage, new RegExp(`^/api/projects/${project.id}$`), () => lastInput)
    await tv.projectNameInput.fill(`新しい名前${tag}`)
    lastInput = Date.now()
    expect(await put).toBeGreaterThanOrEqual(900)
    await expect(tv.savedIcon).toBeVisible()

    await tv.open(project.id)
    await expect(tv.projectNameInput).toHaveValue(`新しい名前${tag}`)
  })

  test('「グリッドビュー」「カード印刷ビュー」「プロジェクト設定」を押すと、それぞれの画面に遷移する', spec(SPEC,
    'ヘッダー > 「グリッドビュー」「カード印刷ビュー」 > WHEN 「グリッドビュー」を押すと',
    'ヘッダー > 「グリッドビュー」「カード印刷ビュー」 > WHEN 「カード印刷ビュー」を押すと',
    'ヘッダー > 「グリッドビュー」「カード印刷ビュー」 > WHEN 「プロジェクト設定」を押すと',
  ), async ({ ownerPage, ownerApi, project }) => {
    await ownerApi.addCard(project.id, { みだし: 'a' })
    await ownerApi.addCard(project.id, { みだし: 'b' })
    const tv = new TableViewPage(ownerPage)

    await tv.open(project.id)
    await tv.gridViewLink.click()
    await expect(ownerPage).toHaveURL(`/projects/${project.id}/grid`)

    await tv.open(project.id)
    await tv.printViewLink.click()
    // すべてのカードの印刷ビュー（カードを限らない）
    await expect(ownerPage).toHaveURL(`/projects/${project.id}/print`)

    await tv.open(project.id)
    await tv.settingsLink.click()
    await expect(ownerPage).toHaveURL(new RegExp(`/projects/${project.id}/settings`))
  })

  test('インポート中は、カードの一覧の代わりに「インポート中です」のダイアログを表示する', spec(SPEC,
    'ヘッダー > WHILE インポート中は',
  ), async ({ ownerPage, ownerApi, owner, project }) => {
    test.setTimeout(120_000)
    await ownerApi.addCard(project.id, { みだし: 'a' })
    await avoidImportTask()
    await postMultipart(owner, `/api/projects/${project.id}/imports`, {
      file: { name: 'import.csv', mimeType: 'text/csv', buffer: Buffer.from('title\nb\n') },
    })

    const tv = new TableViewPage(ownerPage)
    await open(ownerPage, `/projects/${project.id}`)
    await expect(tv.importingDialogTitle).toBeVisible()
    await expect(tv.importingDialog).toContainText('import.csv')
    await expect(tv.table).toHaveCount(0)
  })
})

test.describe('カードの一覧', () => {
  test('列は左から、並び順、「カード入力」、選択、ID、項目、メニューとする', spec(SPEC,
    'カードの一覧 > 列は左から',
  ), async ({ ownerPage, ownerApi, project }) => {
    await ownerApi.addCard(project.id, { みだし: 'あ', メモ: 'い' })
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)

    await expect(tv.headerCells).toHaveCount(7)
    await expect(tv.headerCells.nth(0)).toHaveText('並び順')
    await expect(tv.headerCells.nth(1)).toHaveText('')
    await expect(tv.headerCells.nth(2).getByRole('checkbox')).toBeVisible()
    await expect(tv.headerCells.nth(3)).toHaveText('ID')
    await expect(tv.headerCells.nth(4)).toHaveText('みだし')
    await expect(tv.headerCells.nth(5)).toHaveText('メモ')
    await expect(tv.fieldMenuButton).toBeVisible()

    const cells = tv.row(1).locator(':scope > td')
    await expect(cells.nth(0)).toHaveText('1')
    await expect(cells.nth(1).getByRole('link')).toHaveAccessibleName('カード入力')
    await expect(cells.nth(2).getByRole('checkbox')).toBeVisible()
    await expect(cells.nth(3)).toHaveText('1')
    await expect(cells.nth(4).getByRole('textbox')).toHaveValue('あ')
    await expect(cells.nth(5).getByRole('textbox')).toHaveValue('い')
    await expect(tv.cardMenuButton(1)).toBeVisible()
  })

  test('非表示の項目の列は表示しない', spec(SPEC,
    'カードの一覧 > 列は左から > WHERE 項目を非表示にしている場合',
  ), async ({ ownerPage, ownerApi, project }) => {
    const memo = (await ownerApi.fields(project.id)).find((f) => f.name === 'メモ')!
    await ownerApi.setFieldVisible(project.id, memo.id, false)
    await ownerApi.addCard(project.id, { みだし: 'あ', メモ: 'い' })
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)

    await expect.poll(() => tv.fieldNames()).toEqual(['みだし'])
    await expect(tv.row(1).locator(':scope > td')).toHaveCount(6)
  })

  test('カードを並び順の昇順に表示する', spec(SPEC,
    'カードの一覧 > カードを並び順の昇順に表示する',
  ), async ({ ownerPage, ownerApi, project }) => {
    for (const v of ['a', 'b', 'c']) await ownerApi.addCard(project.id, { みだし: v })
    // グリッドビューでの並び替えと同じ API で、並び順を 3, 1, 2 にする
    await ownerApi.call('put', `/api/projects/${project.id}/cards`, [{ id: 1, order: 2 }, { id: 2, order: 3 }, { id: 3, order: 1 }])
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)

    await expect(tv.idCells).toHaveText(['3', '1', '2'])
    await expect(tv.orderCells).toHaveText(['1', '2', '3'])
  })

  test('グリッドビューで並び替えた順で表示する', spec(SPEC,
    'カードの一覧 > カードを並び順の昇順に表示する > 並び順は',
  ), async ({ ownerPage, ownerApi, project }) => {
    for (const v of ['a', 'b', 'c']) await ownerApi.addCard(project.id, { みだし: v })
    const grid = new GridSelection(ownerPage)
    await grid.open(project.id)

    const saved = ownerPage.waitForResponse((r) => r.request().method() === 'PUT' && r.url().endsWith(`/api/projects/${project.id}/cards`))
    await dragWithMouse(ownerPage, grid.card(2), grid.card(1), 'horizontal')
    await saved

    await grid.tableViewLink.click()
    const tv = new TableViewPage(ownerPage)
    await expect(tv.idCells).toHaveText(['2', '1', '3'])
    await expect(tv.orderCells).toHaveText(['1', '2', '3'])
  })

  test('「カード入力」を押すと、並び替えと検索の条件を引き継いでカード入力ビューに遷移する', spec(SPEC,
    'カードの一覧 > WHEN 「カード入力」を押すと',
  ), async ({ ownerPage, ownerApi, project }) => {
    await ownerApi.addCard(project.id, { みだし: 'apple' })
    await ownerApi.addCard(project.id, { みだし: 'banana' })
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id, '?q=apple&sort=id&direction=desc')
    await expect(tv.idCells).toHaveText(['1'])

    await tv.cardInputLink(1).click()
    await expect(ownerPage).toHaveURL(`/projects/${project.id}/cards/1?q=apple&sort=id&direction=desc`)
  })

  test('画像のあるカードは、「カード入力」のアイコンを画像のアイコンにする', spec(SPEC,
    'カードの一覧 > WHEN 「カード入力」を押すと > WHERE カードに画像がある場合',
  ), async ({ ownerPage, ownerApi, owner, project }) => {
    await ownerApi.addCard(project.id)
    await ownerApi.addCard(project.id)
    await postMultipart(owner, `/api/projects/${project.id}/cards/2/images`, {
      image: { name: 'image.png', mimeType: 'image/png', buffer: IMAGE },
    })
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)

    await expect(tv.cardInputLink(1).locator('[class*=":edit-note "]')).toBeVisible()
    await expect(tv.cardInputLink(2).locator('[class*=":photo-library "]')).toBeVisible()
  })

  test('カードの件数を「全 N 件」、検索中は「（表示件数） / （全件数） 件表示中」と表示する', spec(SPEC,
    'カードの一覧 > カードの件数を「全 N 件」と表示する',
    'カードの一覧 > カードの件数を「全 N 件」と表示する > WHILE 検索中は',
  ), async ({ ownerPage, ownerApi, project }) => {
    for (const v of ['apple', 'banana', 'apricot']) await ownerApi.addCard(project.id, { みだし: v })
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)
    await expect(tv.countText).toHaveText('全 3 件')

    await tv.search('ap')
    await expect(tv.countText).toHaveText('2 / 3 件表示中')
  })
})

test.describe('並び替え', () => {
  test('ID の見出しを押すと昇順、もう一度で降順、さらにもう一度で昇順に並び替え、向きの矢印を表示する', spec(SPEC,
    '並び替え > 列の見出し（並び順・ID・項目名）を押すと',
    '並び替え > 列の見出し > WHEN 並び替えていない列の見出しを押すと',
    '並び替え > 列の見出し > WHEN 昇順に並び替えている列の見出しを押すと',
    '並び替え > 列の見出し > WHEN 降順に並び替えている列の見出しを押すと',
    '並び替え > 並び替えている列の見出しに',
  ), async ({ ownerPage, ownerApi, project }) => {
    for (const v of ['a', 'b', 'c']) await ownerApi.addCard(project.id, { みだし: v })
    await ownerApi.call('put', `/api/projects/${project.id}/cards`, [{ id: 1, order: 2 }, { id: 2, order: 3 }, { id: 3, order: 1 }])
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)

    // 初めは並び順の昇順
    await expect(tv.idCells).toHaveText(['3', '1', '2'])
    await expect(tv.sortIcon('並び順', 'arrow-upward')).toBeVisible()
    await expect(tv.sortIcon('ID', 'swap-vert')).toBeVisible()
    await expect(tv.sortIcon('みだし', 'swap-vert')).toBeVisible()

    await tv.sortLink('ID').click()
    await expect(ownerPage).toHaveURL(/sort=id&direction=asc/)
    await expect(tv.idCells).toHaveText(['1', '2', '3'])
    await expect(tv.sortIcon('ID', 'arrow-upward')).toBeVisible()
    await expect(tv.sortIcon('並び順', 'swap-vert')).toBeVisible()

    await tv.sortLink('ID').click()
    await expect(ownerPage).toHaveURL(/sort=id&direction=desc/)
    await expect(tv.idCells).toHaveText(['3', '2', '1'])
    await expect(tv.sortIcon('ID', 'arrow-downward')).toBeVisible()

    await tv.sortLink('ID').click()
    await expect(ownerPage).toHaveURL(/sort=id&direction=asc/)
    await expect(tv.idCells).toHaveText(['1', '2', '3'])
    await expect(tv.sortIcon('ID', 'arrow-upward')).toBeVisible()

    // 並び替えていない並び順の列は、昇順から
    await tv.sortLink('並び順').click()
    await expect(ownerPage).toHaveURL(/sort=order&direction=asc/)
    await expect(tv.idCells).toHaveText(['3', '1', '2'])
    await tv.sortLink('並び順').click()
    await expect(tv.idCells).toHaveText(['2', '1', '3'])
    await expect(tv.sortIcon('並び順', 'arrow-downward')).toBeVisible()
    await expect(tv.sortIcon('ID', 'swap-vert')).toBeVisible()
  })

  test('並び替えても、今の検索の条件を引き継ぐ', spec(SPEC,
    '並び替え > 列の見出し > 今の検索の条件を引き継ぐ',
  ), async ({ ownerPage, ownerApi, project }) => {
    for (const v of ['apple', 'banana', 'apricot']) await ownerApi.addCard(project.id, { みだし: v })
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)
    await tv.search('ap')
    await expect(tv.idCells).toHaveText(['1', '3'])

    // 見出しのリンクは遷移が終わってから次の向きに変わるので、1 回目の遷移を待ってから押す
    await tv.sortLink('ID').click()
    await expect(ownerPage).toHaveURL(/q=ap&sort=id&direction=asc/)
    await tv.sortLink('ID').click()
    await expect(ownerPage).toHaveURL(/q=ap&sort=id&direction=desc/)
    await expect(tv.idCells).toHaveText(['3', '1'])
    await expect(tv.searchInput).toHaveValue('ap')
  })

  test('【既知の問題】項目名の見出しを押しても、その項目で並び替わらず並び順の昇順で表示する（あるべき: 項目の値を文字列として比べて並び替わる）', withIssue(
    spec(SPEC, '並び替え > 列の見出し > 項目の値は文字列として比べる'),
    knownIssue('docs/ISSUES.md', '項目名で並び替えられない'),
    knownIssue(SPEC, '項目名の見出しを押しても、その項目では並び替わらない'),
  ), async ({ ownerPage, ownerApi, project }) => {
    // 文字列として比べると 10 < 9 < a。並び順（ID）の順とは異なる
    for (const v of ['a', '9', '10']) await ownerApi.addCard(project.id, { みだし: v })
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)

    // 降順に並び替えていても、項目名の見出しを押すと並び順の昇順に戻る
    await tv.sortLink('ID').click()
    await expect(ownerPage).toHaveURL(/sort=id&direction=asc/)
    await tv.sortLink('ID').click()
    await expect(ownerPage).toHaveURL(/sort=id&direction=desc/)
    await expect(tv.idCells).toHaveText(['3', '2', '1'])

    await tv.sortLink('みだし').click()
    await expect(ownerPage).toHaveURL(/sort=\d+&direction=asc/)
    await expect(tv.idCells).toHaveText(['1', '2', '3'])
    await expect(tv.sortIcon('並び順', 'arrow-upward')).toBeVisible()
    await expect(tv.sortIcon('みだし', 'swap-vert')).toBeVisible()

    // もう一度押しても降順にならない
    await tv.sortLink('みだし').click()
    await expect(tv.idCells).toHaveText(['1', '2', '3'])
    await expect(tv.sortIcon('みだし', 'swap-vert')).toBeVisible()
  })
})

test.describe('検索', () => {
  test('文字を入れて Enter を押すと、非表示の項目も含めて、いずれかの項目の値にその文字を含むカードだけを表示する（大文字・小文字は区別しない、ID は対象外）', spec(SPEC,
    '検索 > WHEN 検索の入力欄に文字を入れて Enter を押すと',
    '検索 > WHEN 検索の入力欄に文字を入れて Enter を押すと > 非表示の項目の値も検索の対象とする',
    '検索 > WHEN 検索の入力欄に文字を入れて Enter を押すと > 半角英字の大文字と小文字は区別しない',
  ), async ({ ownerPage, ownerApi, project }) => {
    const memo = (await ownerApi.fields(project.id)).find((f) => f.name === 'メモ')!
    await ownerApi.addCard(project.id, { みだし: 'Apple', メモ: 'x' })
    await ownerApi.addCard(project.id, { みだし: 'banana', メモ: 'APPLE pie' })
    await ownerApi.addCard(project.id, { みだし: 'cherry', メモ: 'y' })
    await ownerApi.setFieldVisible(project.id, memo.id, false)
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)

    await tv.search('apple')
    await expect(ownerPage).toHaveURL(/q=apple/)
    await expect(tv.idCells).toHaveText(['1', '2'])

    // ID は検索の対象としない（値に「3」を含むカードは無い）
    await tv.search('3')
    await expect(tv.rows).toHaveCount(0)
    await expect(tv.countText).toHaveText('0 / 3 件表示中')
  })

  test('検索しても、今の並び替えの条件を引き継ぐ', spec(SPEC,
    '検索 > WHEN 検索の入力欄に文字を入れて Enter を押すと > 今の並び替えの条件を引き継ぐ',
  ), async ({ ownerPage, ownerApi, project }) => {
    for (const v of ['apple', 'banana', 'apricot']) await ownerApi.addCard(project.id, { みだし: v })
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id, '?q=&sort=id&direction=desc')
    await expect(tv.idCells).toHaveText(['3', '2', '1'])

    await tv.search('ap')
    await expect(ownerPage).toHaveURL(/q=ap&sort=id&direction=desc/)
    await expect(tv.idCells).toHaveText(['3', '1'])
    await expect(tv.sortIcon('ID', 'arrow-downward')).toBeVisible()
  })

  test('「×」を押すと、検索をやめてすべてのカードを表示する', spec(SPEC,
    '検索 > WHEN 検索の入力欄の「×」を押すと',
  ), async ({ ownerPage, ownerApi, project }) => {
    for (const v of ['apple', 'banana', 'apricot']) await ownerApi.addCard(project.id, { みだし: v })
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)
    await tv.search('ban')
    await expect(tv.idCells).toHaveText(['2'])

    await tv.searchClearButton.click()
    await expect(tv.idCells).toHaveText(['1', '2', '3'])
    await expect(tv.searchInput).toHaveValue('')
    await expect(tv.countText).toHaveText('全 3 件')
  })

  test('【既知の問題】検索の文字の「&」「#」から後ろが落ち、「+」は空白になり、「_」は任意の文字に当たる（あるべき: 入れた文字のとおりに検索する）', withIssue(
    spec(SPEC, '検索 > WHEN 検索の入力欄に文字を入れて Enter を押すと'),
    knownIssue('docs/ISSUES.md', '検索の文字に記号を含むと入れたとおりに検索されない'),
    knownIssue(SPEC, '検索の文字に「&」「#」「+」を含むと、入れた文字のとおりに検索されない'),
  ), async ({ ownerPage, ownerApi, project }) => {
    await ownerApi.addCard(project.id, { みだし: 'R&D' })
    await ownerApi.addCard(project.id, { みだし: 'R' })
    await ownerApi.addCard(project.id, { みだし: 'C+D' })
    await ownerApi.addCard(project.id, { みだし: 'C D' })
    await ownerApi.addCard(project.id, { みだし: 'abc' })
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)

    // 「C+D」は「C D」で検索する
    await tv.search('C+D')
    await expect(tv.idCells).toHaveText(['4'])
    await expect(tv.searchInput).toHaveValue('C D')

    // 「a_c」は「abc」に当たる
    await tv.search('a_c')
    await expect(tv.idCells).toHaveText(['5'])

    // 「R&D」は「R」で検索する
    await tv.search('R&D')
    await expect(tv.idCells).toHaveText(['1', '2'])
    await expect(tv.searchInput).toHaveValue('R')

    // 「R#D」は、「#」から後ろが URL のフラグメントになり、テーブルビューでない URL（/projects/?q=R?q=R#D…）に移って何も表示しない
    await tv.open(project.id)
    await tv.search('R#D')
    await expect(ownerPage).toHaveURL(/\/projects\/\?q=R\?q=R#D/)
    await expect(tv.table).toHaveCount(0)
    await expect(ownerPage.getByRole('link')).toHaveCount(0)
  })
})

test.describe('カードの値の入力', () => {
  test('セルを押すと複数行の入力欄を開き、値を変更すると入力が止まってから 1 秒後に保存する', spec(SPEC,
    'カードの値の入力 > WHEN セルを押すと',
    'カードの値の入力 > WHEN セルを押すと > WHEN 値を変更すると',
  ), async ({ ownerPage, ownerApi, project }) => {
    await ownerApi.addCard(project.id, { みだし: 'a' })
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)

    await (await tv.cellInput(1, 'メモ')).click()
    await expect(tv.cellEditor).toBeVisible()
    await expect(tv.cellEditor).toBeFocused()

    let lastInput = 0
    const put = waitForPut(ownerPage, new RegExp(`/cards/1/fields/\\d+$`), () => lastInput)
    await tv.cellEditor.fill('1 行目\n2 行目')
    lastInput = Date.now()
    expect(await put).toBeGreaterThanOrEqual(900)
    await expect(tv.cellEditor).toBeVisible()

    await tv.open(project.id)
    await (await tv.cellInput(1, 'メモ')).click()
    await expect(tv.cellEditor).toHaveValue('1 行目\n2 行目')
  })

  test('入力欄の外を押すと、保存して入力欄を閉じる', spec(SPEC,
    'カードの値の入力 > WHEN セルを押すと > WHEN 入力欄の外を押すと',
  ), async ({ ownerPage, ownerApi, project }) => {
    await ownerApi.addCard(project.id, { みだし: 'a' })
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)

    await (await tv.cellInput(1, 'メモ')).click()
    await tv.cellEditor.fill('外を押す')
    const put = ownerPage.waitForRequest((r) => r.method() === 'PUT' && /\/cards\/1\/fields\/\d+$/.test(r.url()))
    const clickedAt = Date.now()
    await tv.countText.click()
    // 入力が止まってから 1 秒を待たずに保存する
    await put
    expect(Date.now() - clickedAt).toBeLessThan(900)
    await expect(tv.cellEditor).toBeHidden()
    await expect(await tv.cellInput(1, 'メモ')).toHaveValue('外を押す')

    await tv.open(project.id)
    await expect(await tv.cellInput(1, 'メモ')).toHaveValue('外を押す')
  })
})

test.describe('項目の編集', () => {
  test('見出しの「…」で、非表示を含むすべての項目の編集欄と、項目の追加欄を開く', spec(SPEC,
    '項目の編集 > 見出しの右端の「…」を押すと',
    '項目の編集 > 「項目を編集」には',
    '項目の編集 > 「新しい項目を追加」には',
  ), async ({ ownerPage, ownerApi, project }) => {
    const memo = (await ownerApi.fields(project.id)).find((f) => f.name === 'メモ')!
    await ownerApi.setFieldVisible(project.id, memo.id, false)
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)

    await tv.fieldMenuButton.click()
    await expect(tv.fieldPanel.getByText('項目を編集')).toBeVisible()
    await expect(tv.fieldPanel.getByText('新しい項目を追加')).toBeVisible()

    await expect(tv.fieldNameInputs).toHaveCount(2)
    await expect(tv.fieldNameInputs.nth(0)).toHaveValue('みだし')
    await expect(tv.fieldNameInputs.nth(1)).toHaveValue('メモ')
    await expect(tv.fieldHandles()).toHaveCount(2)
    await expect(tv.fieldVisibilityIcon(0, 'visibility')).toBeVisible()
    await expect(tv.fieldVisibilityIcon(1, 'visibility-off')).toBeVisible()
    await expect(tv.fieldDeleteButtons()).toHaveCount(2)

    await expect(tv.newFieldInput).toBeVisible()
    await expect(tv.newFieldButton).toBeVisible()
  })

  test('つまみをドラッグして項目を並び替えると、その順を保存し、表の列の順に反映する', spec(SPEC,
    '項目の編集 > 「項目を編集」には > WHEN つまみをドラッグして',
  ), async ({ ownerPage, project }) => {
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)
    await tv.fieldMenuButton.click()

    const saved = ownerPage.waitForResponse((r) => r.request().method() === 'PUT' && r.url().endsWith(`/api/projects/${project.id}/fields`))
    await tv.drag(tv.fieldHandles().nth(1), tv.fieldHandles().nth(0))
    await saved
    await expect(tv.fieldNameInputs.nth(0)).toHaveValue('メモ')
    await expect(tv.fieldNameInputs.nth(1)).toHaveValue('みだし')
    await expect.poll(() => tv.fieldNames()).toEqual(['メモ', 'みだし'])

    await tv.open(project.id)
    await expect.poll(() => tv.fieldNames()).toEqual(['メモ', 'みだし'])
  })

  test('項目名を変更すると、入力が止まってから 1 秒後に保存する', spec(SPEC,
    '項目の編集 > 「項目を編集」には > WHEN 項目名を変更すると',
  ), async ({ ownerPage, project }) => {
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)
    await tv.fieldMenuButton.click()

    let lastInput = 0
    const put = waitForPut(ownerPage, new RegExp(`^/api/projects/${project.id}/fields/\\d+$`), () => lastInput)
    await tv.fieldNameInputs.nth(1).fill('備考')
    lastInput = Date.now()
    expect(await put).toBeGreaterThanOrEqual(900)

    await tv.open(project.id)
    await expect.poll(() => tv.fieldNames()).toEqual(['みだし', '備考'])
  })

  test('表示／非表示を切り替えると、保存し、表とカード入力ビューでその項目を表示する／しない', spec(SPEC,
    '項目の編集 > 「項目を編集」には > WHEN 表示／非表示を切り替えると',
  ), async ({ ownerPage, ownerApi, project }) => {
    await ownerApi.addCard(project.id, { みだし: 'a', メモ: 'b' })
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)
    await tv.fieldMenuButton.click()

    await tv.fieldVisibilityButtons().nth(1).click()
    await expect(tv.fieldVisibilityIcon(1, 'visibility-off')).toBeVisible()
    await expect.poll(() => tv.fieldNames()).toEqual(['みだし'])

    // 保存している（開き直しても非表示）。カード入力ビューにも表示しない
    await tv.open(project.id)
    await expect.poll(() => tv.fieldNames()).toEqual(['みだし'])
    await open(ownerPage, `/projects/${project.id}/cards/1`)
    await expect(ownerPage.getByText('みだし', { exact: true }).filter({ visible: true })).toHaveCount(1)
    await expect(ownerPage.getByText('メモ', { exact: true }).filter({ visible: true })).toHaveCount(0)

    // 表示に戻す
    await tv.open(project.id)
    await tv.fieldMenuButton.click()
    await tv.fieldVisibilityButtons().nth(1).click()
    await expect(tv.fieldVisibilityIcon(1, 'visibility')).toBeVisible()
    await expect.poll(() => tv.fieldNames()).toEqual(['みだし', 'メモ'])
    await open(ownerPage, `/projects/${project.id}/cards/1`)
    await expect(ownerPage.getByText('メモ', { exact: true }).filter({ visible: true })).toHaveCount(1)
  })

  test('削除を押すと確認し、確認すると項目とすべてのカードのその項目の値を削除する', spec(SPEC,
    '項目の編集 > 「項目を編集」には > WHEN 削除を押すと',
    '項目の編集 > 「項目を編集」には > WHEN 削除を押すと > WHEN 確認すると',
  ), async ({ ownerPage, ownerApi, project }) => {
    await ownerApi.addCard(project.id, { みだし: 'a', メモ: 'memo-value' })
    await ownerApi.addCard(project.id, { みだし: 'b', メモ: 'memo-value' })
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)
    await tv.fieldMenuButton.click()

    // 取り消すと削除しない
    const messages: string[] = []
    ownerPage.once('dialog', (dialog) => {
      messages.push(dialog.message())
      void dialog.dismiss()
    })
    await tv.fieldDeleteButtons().nth(1).click()
    await expect.poll(() => messages).toEqual(['削除してよろしいですか？'])
    await expect(tv.fieldNameInputs).toHaveCount(2)

    ownerPage.once('dialog', (dialog) => {
      messages.push(dialog.message())
      void dialog.accept()
    })
    await tv.fieldDeleteButtons().nth(1).click()
    await expect(tv.fieldNameInputs).toHaveCount(1)
    expect(messages).toEqual(['削除してよろしいですか？', '削除してよろしいですか？'])
    await expect.poll(() => tv.fieldNames()).toEqual(['みだし'])

    // 値も消えている（検索は項目を問わずすべての値を対象にする）
    await tv.open(project.id)
    await expect.poll(() => tv.fieldNames()).toEqual(['みだし'])
    await tv.search('memo-value')
    await expect(tv.rows).toHaveCount(0)
  })

  test('項目名が空の間は「追加」を押せず、「追加」を押すと項目を末尾に追加して入力欄を空にする', spec(SPEC,
    '項目の編集 > 「新しい項目を追加」には > WHILE 項目名が空の間は',
    '項目の編集 > 「新しい項目を追加」には > WHEN 「追加」を押すと',
  ), async ({ ownerPage, project }) => {
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)
    await tv.fieldMenuButton.click()

    await expect(tv.newFieldButton).toBeDisabled()
    await tv.newFieldInput.fill('タグ')
    await expect(tv.newFieldButton).toBeEnabled()
    await tv.newFieldButton.click()

    await expect(tv.newFieldInput).toHaveValue('')
    await expect(tv.newFieldButton).toBeDisabled()
    await expect(tv.fieldNameInputs).toHaveCount(3)
    await expect(tv.fieldNameInputs.nth(2)).toHaveValue('タグ')
    await expect.poll(() => tv.fieldNames()).toEqual(['みだし', 'メモ', 'タグ'])

    await tv.open(project.id)
    await expect.poll(() => tv.fieldNames()).toEqual(['みだし', 'メモ', 'タグ'])
  })
})

test.describe('カードの追加', () => {
  test('一覧の下の「追加」を押すと、空のカードを末尾に追加し（ID は最大値 + 1）、「追加しました」と表示する', spec(SPEC,
    'カードの追加 > 一覧の下に「追加」ボタンを表示する',
    'カードの追加 > WHEN 「追加」を押すと',
    'カードの追加 > WHEN 「追加」を押すと > 新しいカードの ID は',
  ), async ({ ownerPage, ownerApi, project }) => {
    for (const v of ['a', 'b', 'c']) await ownerApi.addCard(project.id, { みだし: v })
    await ownerApi.call('delete', `/api/projects/${project.id}/cards/2`)
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)
    await expect(tv.addButton).toHaveAccessibleName('追加')

    await tv.addButton.click()
    await expect(tv.toast('追加しました')).toBeVisible()
    await expect(tv.idCells).toHaveText(['1', '3', '4'])
    await expect(tv.orderCells.last()).toHaveText('4')
    await expect(await tv.cellInput(4, 'みだし')).toHaveValue('')
    await expect(await tv.cellInput(4, 'メモ')).toHaveValue('')
    await expect(tv.countText).toHaveText('全 3 件')
  })

  test('検索中に「追加」を押すと、追加した空のカードは検索に当たらないので一覧に表示しない', spec(SPEC,
    'カードの追加 > WHEN 「追加」を押すと',
  ), async ({ ownerPage, ownerApi, project }) => {
    for (const v of ['apple', 'banana']) await ownerApi.addCard(project.id, { みだし: v })
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id, '?q=apple&sort=order&direction=asc')

    await tv.addButton.click()
    await expect(tv.toast('追加しました')).toBeVisible()
    await expect(tv.countText).toHaveText('1 / 3 件表示中')
    await expect(tv.idCells).toHaveText(['1'])
  })

  test('【既知の問題】検索の条件を引き継いだカード入力ビューで「追加」を押すと、追加したカードではなく検索結果の最後のカードを表示する（あるべき: 追加したカードを表示する）', withIssue(
    spec(SPEC, 'カードの一覧 > WHEN 「カード入力」を押すと'),
    knownIssue('docs/ISSUES.md', '検索中にカードを追加すると別のカードを表示する'),
  ), async ({ ownerPage, ownerApi, project }) => {
    await ownerApi.addCard(project.id, { みだし: 'apple' })
    await ownerApi.addCard(project.id, { みだし: 'banana' })
    await ownerApi.addCard(project.id, { みだし: 'apricot' })
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)
    await tv.search('ap')
    await expect(tv.idCells).toHaveText(['1', '3'])

    // 検索結果の最後のカード（ID 3）のカード入力ビューで「追加」を押す
    await tv.cardInputLink(3).click()
    await expect(ownerPage).toHaveURL(`/projects/${project.id}/cards/3?q=ap&sort=order&direction=asc`)
    await ownerPage.getByRole('button', { name: '追加', exact: true }).click()

    // ID 4 のカードに遷移するが、表示するのは検索結果の最後のカード（ID 3、値 apricot）
    await expect(ownerPage).toHaveURL(`/projects/${project.id}/cards/4?q=ap&sort=order&direction=asc`)
    await expect(ownerPage.getByRole('textbox').filter({ visible: true }).first()).toHaveValue('apricot')
  })
})

test.describe('カードのメニュー', () => {
  test('各行の「…」で、カードのメニューを開く（複製元・複製先が無いカードでは、それらを選べない）', spec(SPEC,
    'カードのメニュー > 各行の「…」を押すと',
  ), async ({ ownerPage, ownerApi, project }) => {
    await ownerApi.addCard(project.id, { みだし: 'a' })
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)

    const menu = new CardMenu(ownerPage, tv.cardMenuButton(1))
    await menu.open()
    await expect(ownerPage.getByRole('menu').getByRole('menuitem')).toHaveText([
      '直下に追加', '直下に複製', '末尾に複製', '別プロジェクトに複製', '複製元カードを表示', '複製先カードを表示', '削除',
    ])
    await expect(menu.item('直下に追加')).toBeEnabled()
    await expect(menu.item('複製元カードを表示')).toBeDisabled()
    await expect(menu.item('複製先カードを表示')).toBeDisabled()
  })

  test('「直下に追加」で、選んだカードのすぐ下に空のカードを追加し、並び順を 1 から振り直して「追加しました」と表示する', spec(SPEC,
    'カードのメニュー > 直下に追加 | 選んだカードのすぐ下に空のカードを追加し',
    'カードのメニュー > 「直下に追加」「直下に複製」では',
    'カードの一覧 > カードを並び順の昇順に表示する > 並び順は',
  ), async ({ ownerPage, ownerApi, project }) => {
    for (const v of ['a', 'b', 'c']) await ownerApi.addCard(project.id, { みだし: v })
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)
    await expect(tv.orderCells).toHaveText(['1', '2', '3'])

    await new CardMenu(ownerPage, tv.cardMenuButton(1)).choose('直下に追加')
    await expect(tv.toast('追加しました')).toBeVisible()
    await expect(tv.idCells).toHaveText(['1', '4', '2', '3'])
    await expect(tv.orderCells).toHaveText(['1', '2', '3', '4'])
    await expect(await tv.cellInput(4, 'みだし')).toHaveValue('')
  })

  test('【既知の問題】前のカードを削除して並び順が飛んでいると、「直下に追加」したカードが選んだカードのすぐ下に入らない（あるべき: すぐ下に入り、並び順を 1 から振り直す）', withIssue(
    spec(SPEC,
      'カードのメニュー > 直下に追加 | 選んだカードのすぐ下に空のカードを追加し',
      'カードのメニュー > 「直下に追加」「直下に複製」では',
    ),
    knownIssue('docs/ISSUES.md', '並び順が飛んでいると「直下に追加」「直下に複製」がすぐ下に入らない'),
  ), async ({ ownerPage, ownerApi, project }) => {
    for (const v of ['a', 'b', 'c', 'd']) await ownerApi.addCard(project.id, { みだし: v })
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)

    // 先頭の 2 枚を削除する（並び順は 3, 4 が残る）
    for (const id of [1, 2]) {
      ownerPage.once('dialog', (dialog) => void dialog.accept())
      await new CardMenu(ownerPage, tv.cardMenuButton(id)).choose('削除')
      await expect(tv.row(id)).toHaveCount(0)
    }
    await expect(tv.orderCells).toHaveText(['3', '4'])

    await new CardMenu(ownerPage, tv.cardMenuButton(3)).choose('直下に追加')
    await expect(tv.toast('追加しました')).toBeVisible()
    // ID 5 は ID 3 のすぐ下ではなく末尾に入り、並び順が ID 4 と重なる
    await expect(tv.idCells).toHaveText(['3', '4', '5'])
    await expect(tv.orderCells).toHaveText(['1', '3', '3'])
  })

  test('「削除」で確認し、確認するとカードを削除して「削除しました」と表示する', spec(SPEC,
    'カードのメニュー > 削除 | 「削除してよろしいですか？」と確認し',
  ), async ({ ownerPage, ownerApi, project }) => {
    for (const v of ['a', 'b']) await ownerApi.addCard(project.id, { みだし: v })
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)

    const messages: string[] = []
    ownerPage.once('dialog', (dialog) => {
      messages.push(dialog.message())
      void dialog.dismiss()
    })
    await new CardMenu(ownerPage, tv.cardMenuButton(1)).choose('削除')
    await expect.poll(() => messages).toEqual(['削除してよろしいですか？'])
    await expect(tv.idCells).toHaveText(['1', '2'])

    ownerPage.once('dialog', (dialog) => {
      messages.push(dialog.message())
      void dialog.accept()
    })
    await new CardMenu(ownerPage, tv.cardMenuButton(1)).choose('削除')
    await expect(tv.toast('削除しました')).toBeVisible()
    await expect(tv.idCells).toHaveText(['2'])
    expect(messages).toEqual(['削除してよろしいですか？', '削除してよろしいですか？'])
  })
})
