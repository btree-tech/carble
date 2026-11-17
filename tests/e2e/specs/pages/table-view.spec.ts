import { readFileSync } from 'node:fs'
import { request, type Page } from '@playwright/test'
import { expect, test } from '../../fixtures'
import { CardViewPage } from '../../pages/CardViewPage'
import { CardMenu } from '../../pages/components/CardMenu'
import { GridSelection } from '../../pages/components/CardSelection'
import { dragWithMouse, TableViewPage } from '../../pages/TableViewPage'
import { SESSION_COOKIE, type Account } from '../../support/db'
import { open } from '../../support/navigation'
import { knownIssue } from '../../support/spec'

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
  test('「ホーム」、プロジェクト名、「スキャン」、各ビューのボタン、検索の入力欄を表示する', { tag: ['@TC-PG-TABLE-HDR1', '@TC-PG-TABLE-HDR4', '@TC-PG-TABLE-HDR5'] }, async ({ ownerPage, project }) => {
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

  test('「ホーム」を押すとプロジェクト一覧に遷移する', { tag: ['@TC-PG-TABLE-HDR2'] }, async ({ ownerPage, project }) => {
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)
    await tv.homeLink.click()
    await expect(ownerPage).toHaveURL('/')
  })

  test('プロジェクト名を変更すると、入力が止まってから 1 秒後に保存し、保存状態のアイコンを表示する', { tag: ['@TC-PG-TABLE-HDR3', '@TC-PG-TABLE-HDR9'] }, async ({ ownerPage, project, tag }) => {
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

  test('「グリッドビュー」「カード印刷ビュー」「プロジェクト設定」を押すと、それぞれの画面に遷移する', { tag: ['@TC-PG-TABLE-HDR6', '@TC-PG-TABLE-HDR7', '@TC-PG-TABLE-HDR8'] }, async ({ ownerPage, ownerApi, project }) => {
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

  test('インポート中は、カードの一覧の代わりに「インポート中です」のダイアログを表示する', { tag: ['@TC-PG-TABLE-HDR15'] }, async ({ ownerPage, ownerApi, owner, project }) => {
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
  test('列は左から、並び順、「カード入力」、選択、ID、項目、メニューとする', { tag: ['@TC-PG-TABLE-LIST1'] }, async ({ ownerPage, ownerApi, project }) => {
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

  test('非表示の項目の列は表示しない', { tag: ['@TC-PG-TABLE-LIST2'] }, async ({ ownerPage, ownerApi, project }) => {
    const memo = (await ownerApi.fields(project.id)).find((f) => f.name === 'メモ')!
    await ownerApi.setFieldVisible(project.id, memo.id, false)
    await ownerApi.addCard(project.id, { みだし: 'あ', メモ: 'い' })
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)

    await expect.poll(() => tv.fieldNames()).toEqual(['みだし'])
    await expect(tv.row(1).locator(':scope > td')).toHaveCount(6)
  })

  test('カードを並び順の昇順に表示する', { tag: ['@TC-PG-TABLE-LIST3'] }, async ({ ownerPage, ownerApi, project }) => {
    for (const v of ['a', 'b', 'c']) await ownerApi.addCard(project.id, { みだし: v })
    // グリッドビューでの並び替えと同じ API で、並び順を 3, 1, 2 にする
    await ownerApi.call('put', `/api/projects/${project.id}/cards`, [{ id: 1, order: 2 }, { id: 2, order: 3 }, { id: 3, order: 1 }])
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)

    await expect(tv.idCells).toHaveText(['3', '1', '2'])
    await expect(tv.orderCells).toHaveText(['1', '2', '3'])
  })

  test('グリッドビューで並び替えた順で表示する', { tag: ['@TC-PG-TABLE-LIST4'] }, async ({ ownerPage, ownerApi, project }) => {
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

  test('「カード入力」を押すと、並び替えと検索の条件を引き継いでカード入力ビューに遷移する', { tag: ['@TC-PG-TABLE-LIST5'] }, async ({ ownerPage, ownerApi, project }) => {
    await ownerApi.addCard(project.id, { みだし: 'apple' })
    await ownerApi.addCard(project.id, { みだし: 'banana' })
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id, '?q=apple&sort=id&direction=desc')
    await expect(tv.idCells).toHaveText(['1'])

    await tv.cardInputLink(1).click()
    await expect(ownerPage).toHaveURL(`/projects/${project.id}/cards/1?q=apple&sort=id&direction=desc`)
  })

  test('画像のあるカードは、「カード入力」のアイコンを画像のアイコンにする', { tag: ['@TC-PG-TABLE-LIST6'] }, async ({ ownerPage, ownerApi, owner, project }) => {
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

  test('カードの件数を「全 N 件」、検索中は「（表示件数） / （全件数） 件表示中」と表示する', { tag: ['@TC-PG-TABLE-LIST7', '@TC-PG-TABLE-LIST8'] }, async ({ ownerPage, ownerApi, project }) => {
    for (const v of ['apple', 'banana', 'apricot']) await ownerApi.addCard(project.id, { みだし: v })
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)
    await expect(tv.countText).toHaveText('全 3 件')

    await tv.search('ap')
    await expect(tv.countText).toHaveText('2 / 3 件表示中')
  })
})

test.describe('並び替え', () => {
  test('ID の見出しを押すと昇順、もう一度で降順、さらにもう一度で昇順に並び替え、向きの矢印を表示する', { tag: ['@TC-PG-TABLE-SORT2', '@TC-PG-TABLE-SORT3', '@TC-PG-TABLE-SORT4', '@TC-PG-TABLE-SORT7'] }, async ({ ownerPage, ownerApi, project }) => {
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

  test('並び替えても、今の検索の条件を引き継ぐ', { tag: ['@TC-PG-TABLE-SORT6'] }, async ({ ownerPage, ownerApi, project }) => {
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

  test('【既知の問題】項目名の見出しを押しても、その項目で並び替わらず並び順の昇順で表示する（あるべき: 項目の値を文字列として比べて並び替わる）', { annotation: [knownIssue('docs/ISSUES.md', '項目名で並び替えられない'), knownIssue(SPEC, '項目名の見出しを押しても、その項目では並び替わらない')] }, async ({ ownerPage, ownerApi, project }) => {
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
  test('文字を入れて Enter を押すと、非表示の項目も含めて、いずれかの項目の値にその文字を含むカードだけを表示する（大文字・小文字は区別しない、ID は対象外）', { tag: ['@TC-PG-TABLE-SRCH1', '@TC-PG-TABLE-SRCH2', '@TC-PG-TABLE-SRCH3'] }, async ({ ownerPage, ownerApi, project }) => {
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

  test('検索しても、今の並び替えの条件を引き継ぐ', { tag: ['@TC-PG-TABLE-SRCH4'] }, async ({ ownerPage, ownerApi, project }) => {
    for (const v of ['apple', 'banana', 'apricot']) await ownerApi.addCard(project.id, { みだし: v })
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id, '?q=&sort=id&direction=desc')
    await expect(tv.idCells).toHaveText(['3', '2', '1'])

    await tv.search('ap')
    await expect(ownerPage).toHaveURL(/q=ap&sort=id&direction=desc/)
    await expect(tv.idCells).toHaveText(['3', '1'])
    await expect(tv.sortIcon('ID', 'arrow-downward')).toBeVisible()
  })

  test('「×」を押すと、検索をやめてすべてのカードを表示する', { tag: ['@TC-PG-TABLE-SRCH5'] }, async ({ ownerPage, ownerApi, project }) => {
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

  test('【既知の問題】検索の文字の「&」「#」から後ろが落ち、「+」は空白になり、「_」は任意の文字に当たる（あるべき: 入れた文字のとおりに検索する）', { annotation: [knownIssue('docs/ISSUES.md', '検索の文字に記号を含むと入れたとおりに検索されない'), knownIssue(SPEC, '検索の文字に「&」「#」「+」を含むと、入れた文字のとおりに検索されない')] }, async ({ ownerPage, ownerApi, project }) => {
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
  test('セルを押すと複数行の入力欄を開き、値を変更すると入力が止まってから 1 秒後に保存する', { tag: ['@TC-PG-TABLE-VAL1', '@TC-PG-TABLE-VAL2'] }, async ({ ownerPage, ownerApi, project }) => {
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

  test('入力欄の外を押すと、保存して入力欄を閉じる', { tag: ['@TC-PG-TABLE-VAL3'] }, async ({ ownerPage, ownerApi, project }) => {
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
  test('見出しの「…」で、非表示を含むすべての項目の編集欄と、項目の追加欄を開く', { tag: ['@TC-PG-TABLE-FLD1', '@TC-PG-TABLE-FLD2', '@TC-PG-TABLE-FLD8'] }, async ({ ownerPage, ownerApi, project }) => {
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

  test('つまみをドラッグして項目を並び替えると、その順を保存し、表の列の順に反映する', { tag: ['@TC-PG-TABLE-FLD3'] }, async ({ ownerPage, project }) => {
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

  test('項目名を変更すると、入力が止まってから 1 秒後に保存する', { tag: ['@TC-PG-TABLE-FLD4'] }, async ({ ownerPage, project }) => {
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

  test('表示／非表示を切り替えると、保存し、表とカード入力ビューでその項目を表示する／しない', { tag: ['@TC-PG-TABLE-FLD5'] }, async ({ ownerPage, ownerApi, project }) => {
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

  test('削除を押すと確認し、確認すると項目とすべてのカードのその項目の値を削除する', { tag: ['@TC-PG-TABLE-FLD6', '@TC-PG-TABLE-FLD7'] }, async ({ ownerPage, ownerApi, project }) => {
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

  test('項目名が空の間は「追加」を押せず、「追加」を押すと項目を末尾に追加して入力欄を空にする', { tag: ['@TC-PG-TABLE-FLD9', '@TC-PG-TABLE-FLD10'] }, async ({ ownerPage, project }) => {
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
  test('一覧の下の「追加」を押すと、空のカードを末尾に追加し（ID は最大値 + 1）、「追加しました」と表示する', { tag: ['@TC-PG-TABLE-ADD1', '@TC-PG-TABLE-ADD2', '@TC-PG-TABLE-ADD3'] }, async ({ ownerPage, ownerApi, project }) => {
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

  test('検索中に「追加」を押すと、追加した空のカードは検索に当たらないので一覧に表示しない', { tag: ['@TC-PG-TABLE-ADD2'] }, async ({ ownerPage, ownerApi, project }) => {
    for (const v of ['apple', 'banana']) await ownerApi.addCard(project.id, { みだし: v })
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id, '?q=apple&sort=order&direction=asc')

    await tv.addButton.click()
    await expect(tv.toast('追加しました')).toBeVisible()
    await expect(tv.countText).toHaveText('1 / 3 件表示中')
    await expect(tv.idCells).toHaveText(['1'])
  })

  test('【既知の問題】検索の条件を引き継いだカード入力ビューで「追加」を押すと、追加したカードではなく検索結果の最後のカードを表示する（あるべき: 追加したカードを表示する）', { annotation: [knownIssue('docs/ISSUES.md', '検索中にカードを追加すると別のカードを表示する')] }, async ({ ownerPage, ownerApi, project }) => {
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
  test('各行の「…」で、カードのメニューを開く（複製元・複製先が無いカードでは、それらを選べない）', { tag: ['@TC-PG-TABLE-MENU1'] }, async ({ ownerPage, ownerApi, project }) => {
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

  test('「直下に追加」で、選んだカードのすぐ下に空のカードを追加し、並び順を 1 から振り直して「追加しました」と表示する', { tag: ['@TC-PG-TABLE-MENU3', '@TC-PG-TABLE-MENU2', '@TC-PG-TABLE-LIST4'] }, async ({ ownerPage, ownerApi, project }) => {
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

  test('【既知の問題】前のカードを削除して並び順が飛んでいると、「直下に追加」したカードが選んだカードのすぐ下に入らない（あるべき: すぐ下に入り、並び順を 1 から振り直す）', { annotation: [knownIssue('docs/ISSUES.md', '並び順が飛んでいると「直下に追加」「直下に複製」がすぐ下に入らない')] }, async ({ ownerPage, ownerApi, project }) => {
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

  test('「削除」で確認し、確認するとカードを削除して「削除しました」と表示する', { tag: ['@TC-PG-TABLE-MENU9'] }, async ({ ownerPage, ownerApi, project }) => {
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

test.describe('ユーザーストーリー', () => {
  test('研究者が、カードを追加しながらセルに続けて打ち込み、保存を待たずに次のセルへ移っても、打ち込みの途中で保存されても、打ったとおりの値が残る', { tag: ['@story', '@TC-PG-TABLE-US1'] }, async ({ ownerPage, ownerApi, project }) => {
    const fields = await ownerApi.fields(project.id)
    const midashi = fields.find((f) => f.name === 'みだし')!.id
    const memo = fields.find((f) => f.name === 'メモ')!.id
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)
    await expect(tv.countText).toHaveText('全 0 件')

    // 1 枚目を追加し、「みだし」を打ち込んだら、保存を待たずに「メモ」のセルへ移って打ち込む
    await tv.addButton.click()
    await expect(tv.idCells).toHaveText(['1'])
    await tv.typeInCell(1, 'みだし', '土器片')
    const midashiSaved = tv.waitForCellSave(1, midashi, '土器片')
    await tv.typeInCell(1, 'メモ', '第1層から出土')
    await midashiSaved
    const memoSaved = tv.waitForCellSave(1, memo, '第1層から出土')
    await tv.countText.click()
    await memoSaved

    // 2 枚目を追加し、打ち込みの途中で手を止める（入力が止まって保存される）。続けて打ち込んでも、入れた文字が消えたり乱れたりしない
    await tv.addButton.click()
    await expect(tv.idCells).toHaveText(['1', '2'])
    const halfSaved = tv.waitForCellSave(2, midashi, '石器')
    await tv.typeInCell(2, 'みだし', '石器')
    await halfSaved
    await ownerPage.keyboard.type('（剥片）', { delay: 50 })
    await expect(tv.activeCellEditor).toHaveValue('石器（剥片）')
    const allSaved = tv.waitForCellSave(2, midashi, '石器（剥片）')
    await tv.countText.click()
    await allSaved
    await expect(await tv.cellInput(2, 'みだし')).toHaveValue('石器（剥片）')

    // 開き直しても、打ち込んだ値がすべて残っている
    await tv.open(project.id)
    await expect(tv.countText).toHaveText('全 2 件')
    await expect(await tv.cellInput(1, 'みだし')).toHaveValue('土器片')
    await expect(await tv.cellInput(1, 'メモ')).toHaveValue('第1層から出土')
    await expect(await tv.cellInput(2, 'みだし')).toHaveValue('石器（剥片）')
    await expect(await tv.cellInput(2, 'メモ')).toHaveValue('')
  })

  test('研究者が、広い画面で表をブラウザの幅いっぱいに広げて 5 つの項目を一度に見渡し、右端の項目のセルにもそのまま入力する', { tag: ['@story', '@TC-PG-TABLE-US2'] }, async ({ ownerPage, ownerApi, project }) => {
    // 初期の「みだし」「メモ」に 3 つ足して 5 項目にする（項目の列は 1 列 240px ほどで、ヘッダーの最大幅 1280px を超える）
    for (const name of ['出土地点', '層位', '時代']) await ownerApi.addField(project.id, name)
    const era = (await ownerApi.fields(project.id)).find((f) => f.name === '時代')!.id
    await ownerApi.addCard(project.id, { みだし: '土器片', メモ: '口縁部', 出土地点: 'A区', 層位: '第1層' })
    await ownerApi.addCard(project.id, { みだし: '石器', メモ: '剥片', 出土地点: 'B区', 層位: '第2層' })
    await ownerPage.setViewportSize({ width: 1920, height: 1080 })
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)

    // 表はヘッダーの幅（1280px）に収めず、ブラウザの幅に広がり、すべての項目の列が横にスクロールせずに見える
    await expect.poll(() => tv.fieldNames()).toEqual(['みだし', 'メモ', '出土地点', '層位', '時代'])
    expect((await tv.table.boundingBox())!.width).toBeGreaterThan(1280)
    for (const name of ['みだし', 'メモ', '出土地点', '層位', '時代']) {
      await expect(tv.sortLink(name)).toBeInViewport({ ratio: 1 })
    }
    await expect(await tv.cellInput(2, '時代')).toBeInViewport({ ratio: 1 })

    // 右端の項目のセルに、そのまま入力する
    const saved = tv.waitForCellSave(2, era, '縄文時代')
    await tv.typeInCell(2, '時代', '縄文時代')
    await tv.countText.click()
    await saved

    await tv.open(project.id)
    await expect(await tv.cellInput(2, '時代')).toHaveValue('縄文時代')
    await expect(await tv.cellInput(2, '出土地点')).toHaveValue('B区')
  })

  test('研究者が、キーワードで絞り込み、ID の見出しで新しい順に並べ替えて、目的のカードのカード入力ビューにたどり着く', { tag: ['@story', '@TC-PG-TABLE-US3'] }, async ({ ownerPage, ownerApi, project }) => {
    await ownerApi.addCard(project.id, { みだし: '土器 口縁部', メモ: 'A区' })
    await ownerApi.addCard(project.id, { みだし: '石器', メモ: 'B区' })
    await ownerApi.addCard(project.id, { みだし: '土器 胴部', メモ: 'B区 第2層' })
    await ownerApi.addCard(project.id, { みだし: '骨片', メモ: '土器の下から出土' })
    await ownerApi.addCard(project.id, { みだし: '木片', メモ: 'A区' })
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)
    await expect(tv.countText).toHaveText('全 5 件')

    // 「土器」で絞り込む（メモに含むカードも当たる）
    await tv.search('土器')
    await expect(tv.idCells).toHaveText(['1', '3', '4'])
    await expect(tv.countText).toHaveText('3 / 5 件表示中')

    // 絞り込んだまま、ID の見出しで新しい順（降順）に並べ替える
    await tv.sortLink('ID').click()
    await expect(ownerPage).toHaveURL(/sort=id&direction=asc/)
    await tv.sortLink('ID').click()
    await expect(ownerPage).toHaveURL(/sort=id&direction=desc/)
    await expect(tv.idCells).toHaveText(['4', '3', '1'])
    await expect(tv.searchInput).toHaveValue('土器')

    // 目的のカード（土器 胴部）を見つけ、カード入力ビューを開く
    await expect(await tv.cellInput(3, 'みだし')).toHaveValue('土器 胴部')
    await tv.cardInputLink(3).click()
    await expect(ownerPage).toHaveURL(new RegExp(`/projects/${project.id}/cards/3\\?.*sort=id&direction=desc`))
    const view = new CardViewPage(ownerPage)
    await expect(view.field('みだし')).toHaveValue('土器 胴部')
    await expect(view.field('メモ')).toHaveValue('B区 第2層')
  })

  test('研究者が、グリッドビューで資料の順に並べ替えたカードを、テーブルビューでその順に見て、先頭のカードから「次」で順番どおりに開いていく', { tag: ['@story', '@TC-PG-TABLE-US4'] }, async ({ ownerPage, ownerApi, project }) => {
    await ownerApi.addCard(project.id, { みだし: '資料 2 枚目' })
    await ownerApi.addCard(project.id, { みだし: '資料 1 枚目' })
    await ownerApi.addCard(project.id, { みだし: '資料 3 枚目' })

    // グリッドビューで、資料の 1 枚目（ID 2）を先頭に並べ替える（隣のカードの前へドラッグする）
    const grid = new GridSelection(ownerPage)
    await grid.open(project.id)
    const saved = ownerPage.waitForResponse((r) => r.request().method() === 'PUT' && r.url().endsWith(`/api/projects/${project.id}/cards`))
    await dragWithMouse(ownerPage, grid.card(2), grid.card(1), 'horizontal')
    await saved

    // テーブルビューでは、グリッドビューで決めた順に並ぶ
    await grid.tableViewLink.click()
    const tv = new TableViewPage(ownerPage)
    await expect(tv.idCells).toHaveText(['2', '1', '3'])
    await expect(tv.orderCells).toHaveText(['1', '2', '3'])

    // 先頭のカードから、「次」で順番どおりに開いていく
    const view = new CardViewPage(ownerPage)
    await tv.cardInputLink(2).click()
    await expect(ownerPage).toHaveURL(new RegExp(`/projects/${project.id}/cards/2(\\?|$)`))
    await expect(view.field('みだし')).toHaveValue('資料 1 枚目')
    await view.nextLink.click()
    await expect(ownerPage).toHaveURL(new RegExp(`/projects/${project.id}/cards/1(\\?|$)`))
    await expect(view.field('みだし')).toHaveValue('資料 2 枚目')
    await view.nextLink.click()
    await expect(ownerPage).toHaveURL(new RegExp(`/projects/${project.id}/cards/3(\\?|$)`))
    await expect(view.field('みだし')).toHaveValue('資料 3 枚目')
    // 最後のカードには「次」が無い
    await expect(view.nextLink).toHaveCount(0)
  })

  test('研究者が、項目の名前を変え、項目を足して並べ替え、使わない項目を隠して、資料に合った表にしてから入力する', { tag: ['@story', '@TC-PG-TABLE-US5'] }, async ({ ownerPage, ownerApi, project }) => {
    const midashi = (await ownerApi.fields(project.id)).find((f) => f.name === 'みだし')!
    await ownerApi.addCard(project.id, { みだし: '土器', メモ: '仮のメモ' })
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)
    await tv.fieldMenuButton.click()

    // 「みだし」を「遺物名」に変える
    const renamed = ownerPage.waitForResponse((r) => r.request().method() === 'PUT'
      && r.url().endsWith(`/api/projects/${project.id}/fields/${midashi.id}`)
      && (r.request().postDataJSON() as { name?: string } | null)?.name === '遺物名')
    await tv.fieldNameInputs.nth(0).fill('遺物名')
    await renamed

    // 「出土地点」を足す（末尾に入る）
    await tv.newFieldInput.fill('出土地点')
    await tv.newFieldButton.click()
    await expect(tv.fieldNameInputs).toHaveCount(3)
    await expect(tv.fieldNameInputs.nth(2)).toHaveValue('出土地点')

    // 「出土地点」を「遺物名」のすぐ後ろ（「メモ」の前）へ並べ替える
    const reordered = ownerPage.waitForResponse((r) => r.request().method() === 'PUT' && r.url().endsWith(`/api/projects/${project.id}/fields`))
    await tv.drag(tv.fieldHandles().nth(2), tv.fieldHandles().nth(1))
    await reordered
    await expect(tv.fieldNameInputs.nth(0)).toHaveValue('遺物名')
    await expect(tv.fieldNameInputs.nth(1)).toHaveValue('出土地点')
    await expect(tv.fieldNameInputs.nth(2)).toHaveValue('メモ')

    // 使わない「メモ」を隠す
    await tv.fieldVisibilityButtons().nth(2).click()
    await expect(tv.fieldVisibilityIcon(2, 'visibility-off')).toBeVisible()

    // 開き直すと、表は資料に合った列になり、元の値も残っている
    await tv.open(project.id)
    await expect.poll(() => tv.fieldNames()).toEqual(['遺物名', '出土地点'])
    await expect(await tv.cellInput(1, '遺物名')).toHaveValue('土器')

    // 足した項目のセルに入力する
    const fieldId = (await ownerApi.fields(project.id)).find((f) => f.name === '出土地点')!.id
    const saved = tv.waitForCellSave(1, fieldId, 'A区 第2層')
    await tv.typeInCell(1, '出土地点', 'A区 第2層')
    await tv.countText.click()
    await saved

    // カード入力ビューも同じ項目で表示する
    const view = new CardViewPage(ownerPage)
    await view.open(project.id, 1)
    await expect(view.field('遺物名')).toHaveValue('土器')
    await expect(view.field('出土地点')).toHaveValue('A区 第2層')
    await expect(view.text('メモ')).toHaveCount(0)
  })

  test('研究者が、カードや項目の「削除」を誤って押しても確認で取り消してデータを守り、確かめたうえで不要なカードだけを削除する', { tag: ['@story', '@TC-PG-TABLE-US6'] }, async ({ ownerPage, ownerApi, project }) => {
    await ownerApi.addCard(project.id, { みだし: '土器', メモ: '大事な記録' })
    await ownerApi.addCard(project.id, { みだし: '石器', メモ: '別の記録' })
    await ownerApi.addCard(project.id, { みだし: '誤って作ったカード' })
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)

    const messages: string[] = []
    const answerNext = (accept: boolean) => ownerPage.once('dialog', (dialog) => {
      messages.push(dialog.message())
      void (accept ? dialog.accept() : dialog.dismiss())
    })

    // 1 枚目のカードの「削除」を誤って押し、確認で取り消す
    answerNext(false)
    await new CardMenu(ownerPage, tv.cardMenuButton(1)).choose('削除')
    await expect.poll(() => messages).toEqual(['削除してよろしいですか？'])
    await expect(tv.idCells).toHaveText(['1', '2', '3'])

    // 「メモ」の項目の削除を誤って押し、確認で取り消す
    await tv.fieldMenuButton.click()
    answerNext(false)
    await tv.fieldDeleteButtons().nth(1).click()
    await expect.poll(() => messages).toHaveLength(2)
    await expect(tv.fieldNameInputs).toHaveCount(2)

    // 開き直しても、カードも項目も値も残っている
    await tv.open(project.id)
    await expect(tv.idCells).toHaveText(['1', '2', '3'])
    await expect.poll(() => tv.fieldNames()).toEqual(['みだし', 'メモ'])
    await expect(await tv.cellInput(1, 'メモ')).toHaveValue('大事な記録')

    // 確かめたうえで、不要なカードだけを削除する
    answerNext(true)
    await new CardMenu(ownerPage, tv.cardMenuButton(3)).choose('削除')
    await expect(tv.toast('削除しました')).toBeVisible()
    await expect(tv.idCells).toHaveText(['1', '2'])
    expect(messages).toEqual(['削除してよろしいですか？', '削除してよろしいですか？', '削除してよろしいですか？'])

    await tv.open(project.id)
    await expect(tv.idCells).toHaveText(['1', '2'])
    await expect(await tv.cellInput(1, 'メモ')).toHaveValue('大事な記録')
    await expect(await tv.cellInput(2, 'メモ')).toHaveValue('別の記録')
  })
})
