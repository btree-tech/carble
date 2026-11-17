import { expect, test } from '../../fixtures'
import { addImageByApi, CardViewPage, getCardByApi } from '../../pages/CardViewPage'
import { ScanButton } from '../../pages/components/ScanButton'
import { PrintViewPage } from '../../pages/PrintViewPage'
import { TableViewPage } from '../../pages/TableViewPage'
import { knownIssue } from '../../support/spec'

const SPEC = 'pages/print-view.md'

type Box = { x: number, y: number, width: number, height: number }
const box = async (locator: { boundingBox: () => Promise<Box | null> }) => (await locator.boundingBox())!
/** 縮小したプレビューの位置の誤差 */
const near = (a: number, b: number) => Math.abs(a - b) < 4

test.describe('ヘッダー', () => {
  test('すべてのカードの印刷では、プロジェクト名と「テーブルビュー」を表示し、押すとテーブルビューに遷移する', { tag: ['@TC-PG-PRINT-HDR1', '@TC-PG-PRINT-HDR2'] }, async ({ ownerPage, ownerApi, project }) => {
    await ownerApi.addCard(project.id)
    const print = new PrintViewPage(ownerPage)
    await print.open(project.id)

    await expect(print.text(project.name)).toBeVisible()
    await expect(print.cardViewLink).toHaveCount(0)

    await print.tableViewLink.click()

    await expect(ownerPage).toHaveURL(`/projects/${project.id}`)
  })

  test('1 枚のカードの印刷では「カード入力ビュー」も表示し、カード入力ビューから引き継いだ条件を引き継いで遷移する', { tag: ['@TC-PG-PRINT-HDR3', '@TC-PG-PRINT-HDR4', '@TC-PG-PRINT-HDR5'] }, async ({ ownerPage, ownerApi, project, tag }) => {
    const card = await ownerApi.addCard(project.id, { みだし: `当たる${tag}` })
    const view = new CardViewPage(ownerPage)
    await view.open(project.id, card.id, `q=当たる${tag}&sort=id&direction=desc`)
    await view.printViewLink.click()
    const print = new PrintViewPage(ownerPage)
    await expect(print.printButton).toBeVisible()

    await expect(print.text(project.name)).toBeVisible()
    const query = new URLSearchParams({ q: `当たる${tag}`, sort: 'id', direction: 'desc' }).toString()
    await expect(print.tableViewLink).toHaveAttribute('href', `/projects/${project.id}?${query}`)
    await expect(print.cardViewLink).toHaveAttribute('href', `/projects/${project.id}/cards/${card.id}?${query}`)

    await print.cardViewLink.click()

    await expect(ownerPage).toHaveURL(`/projects/${project.id}/cards/${card.id}?${query}`)
    await expect(view.idValue).toHaveText(`ID${card.id}`)
  })
})

test.describe('プレビュー', () => {
  test('すべてのカードの印刷では、すべてのカードを並び順の昇順にプレビューする', { tag: ['@TC-PG-PRINT-PREV1'] }, async ({ ownerPage, ownerApi, project }) => {
    const c1 = await ownerApi.addCard(project.id, { みだし: 'カード1' })
    const c2 = await ownerApi.addCard(project.id, { みだし: 'カード2' })
    const c3 = await ownerApi.addCard(project.id, { みだし: 'カード3' })
    await ownerApi.call('put', `/api/projects/${project.id}/cards`, [{ id: c1.id, order: 2 }, { id: c2.id, order: 3 }, { id: c3.id, order: 1 }])
    const print = new PrintViewPage(ownerPage)
    await print.open(project.id)

    await expect(print.cards).toHaveCount(3)
    await expect(print.card(0)).toContainText('カード3')
    await expect(print.card(1)).toContainText('カード1')
    await expect(print.card(2)).toContainText('カード2')
  })

  test('1 枚のカードの印刷では、そのカードだけをプレビューする', { tag: ['@TC-PG-PRINT-PREV2'] }, async ({ ownerPage, ownerApi, project }) => {
    await ownerApi.addCard(project.id, { みだし: 'カード1' })
    const card = await ownerApi.addCard(project.id, { みだし: 'カード2' })
    await ownerApi.addCard(project.id, { みだし: 'カード3' })
    const print = new PrintViewPage(ownerPage)
    await print.open(project.id, card.id)

    await expect(print.cards).toHaveCount(1)
    await expect(print.card()).toContainText('カード2')
  })

  test('領域ごとに項目名と値・ID・元の画像を表示し、値の改行はそのまま表示する。固定領域でない領域に QR コードを表示する', { tag: ['@TC-PG-PRINT-PREV3', '@TC-PG-PRINT-PREV4', '@TC-PG-PRINT-PREV5', '@TC-PG-PRINT-PREV6'] }, async ({ ownerPage, ownerApi, project }) => {
    const card = await ownerApi.addCard(project.id, { みだし: '見出しの値', メモ: '1行目\n2行目' })
    const image = await addImageByApi(ownerPage, project.id, card.id, 'red.png')
    const print = new PrintViewPage(ownerPage)
    await print.open(project.id, card.id)
    const preview = print.card()

    // パターン1: 固定領域1 = 画像、固定領域2 = みだし、固定領域でない領域 = ID・メモ
    await expect(print.areas(preview)).toHaveCount(3)
    await expect(print.photos(print.area(preview, 1))).toHaveAttribute('src', `/uploads/images/${image.filename}`)
    await expect(print.area(preview, 2)).toHaveText(/^\s*みだし\s*見出しの値\s*$/)
    const unreserved = print.area(preview, 3)
    await expect(unreserved).toContainText(`ID ${card.id}`)
    expect(await unreserved.innerText()).toContain('メモ\n1行目\n2行目')

    await expect(print.qrCode(unreserved)).toHaveCount(1)
    await expect(print.qrCode(print.area(preview, 1))).toHaveCount(0)
    await expect(print.qrCode(print.area(preview, 2))).toHaveCount(0)
  })
})

test.describe('設定', () => {
  test('「レイアウト」は「パターン1」〜「パターン3」から選び、初期値は「パターン1」', { tag: ['@TC-PG-PRINT-CONF1'] }, async ({ ownerPage, ownerApi, project }) => {
    const card = await ownerApi.addCard(project.id)
    const print = new PrintViewPage(ownerPage)
    await print.open(project.id, card.id)

    await expect(print.layoutSelect.getByRole('option')).toHaveText(['パターン1', 'パターン2', 'パターン3'])
    await expect(print.layoutSelect.locator('option:checked')).toHaveText('パターン1')
  })

  test('パターン1は、固定領域1（左上の大きい領域）・固定領域2（下段の全幅）と、右上の固定領域でない領域', { tag: ['@TC-PG-PRINT-CONF15'] }, async ({ ownerPage, ownerApi, project }) => {
    const card = await ownerApi.addCard(project.id)
    const print = new PrintViewPage(ownerPage)
    await print.open(project.id, card.id)
    const preview = print.card()

    await expect(print.reservedSelects).toHaveCount(2)
    await expect(print.areas(preview)).toHaveCount(3)
    const [c, a1, a2, a3] = [await box(preview), await box(print.area(preview, 1)), await box(print.area(preview, 2)), await box(print.area(preview, 3))]
    expect(near(a1.x, c.x) && near(a1.y, c.y)).toBe(true)
    expect(a1.width).toBeGreaterThan(a3.width)
    expect(near(a3.y, c.y) && near(a3.x + a3.width, c.x + c.width)).toBe(true)
    expect(near(a2.x, c.x) && near(a2.width, c.width) && near(a2.y + a2.height, c.y + c.height)).toBe(true)
    expect(a2.y).toBeGreaterThan(a1.y + a1.height - 4)
    await expect(print.qrCode(print.area(preview, 3))).toHaveCount(1)
  })

  test('パターン2は、固定領域1（左）と、右の固定領域でない領域', { tag: ['@TC-PG-PRINT-CONF16'] }, async ({ ownerPage, ownerApi, project }) => {
    const card = await ownerApi.addCard(project.id)
    const print = new PrintViewPage(ownerPage)
    await print.open(project.id, card.id)
    const preview = print.card()

    await print.layoutSelect.selectOption({ label: 'パターン2' })

    await expect(print.reservedSelects).toHaveCount(1)
    await expect(print.reservedSelect(1)).toBeVisible()
    await expect(print.areas(preview)).toHaveCount(2)
    const [c, a1, a2] = [await box(preview), await box(print.area(preview, 1)), await box(print.area(preview, 2))]
    expect(near(a1.x, c.x) && near(a1.height, c.height)).toBe(true)
    expect(near(a2.x + a2.width, c.x + c.width) && near(a2.height, c.height)).toBe(true)
    expect(a2.x).toBeGreaterThan(a1.x + a1.width - 4)
    await expect(print.qrCode(print.area(preview, 2))).toHaveCount(1)
    await expect(print.qrCode(print.area(preview, 1))).toHaveCount(0)
  })

  test('パターン3は、固定領域1（左上）・固定領域2（左下）と、右（全高）の固定領域でない領域', { tag: ['@TC-PG-PRINT-CONF17'] }, async ({ ownerPage, ownerApi, project }) => {
    const card = await ownerApi.addCard(project.id)
    const print = new PrintViewPage(ownerPage)
    await print.open(project.id, card.id)
    const preview = print.card()

    await print.layoutSelect.selectOption({ label: 'パターン3' })

    await expect(print.reservedSelects).toHaveCount(2)
    await expect(print.areas(preview)).toHaveCount(3)
    const [c, a1, a2, a3] = [await box(preview), await box(print.area(preview, 1)), await box(print.area(preview, 2)), await box(print.area(preview, 3))]
    expect(near(a1.x, c.x) && near(a1.y, c.y)).toBe(true)
    expect(near(a2.x, c.x) && near(a2.width, a1.width) && near(a2.y + a2.height, c.y + c.height)).toBe(true)
    expect(a2.y).toBeGreaterThan(a1.y + a1.height - 4)
    expect(near(a3.y, c.y) && near(a3.height, c.height) && near(a3.x + a3.width, c.x + c.width)).toBe(true)
    await expect(print.qrCode(print.area(preview, 3))).toHaveCount(1)
  })

  test('固定領域では「画像」「ID」とすべての項目から選び、初期値は固定領域1 が画像、固定領域2 が最初に表示している項目', { tag: ['@TC-PG-PRINT-CONF2', '@TC-PG-PRINT-CONF3'] }, async ({ ownerPage, ownerApi, project }) => {
    const fields = await ownerApi.fields(project.id)
    // 最初の項目（みだし）を非表示にすると、最初に表示している項目はメモ
    await ownerApi.setFieldVisible(project.id, fields.find((f) => f.name === 'みだし')!.id, false)
    const card = await ownerApi.addCard(project.id)
    const print = new PrintViewPage(ownerPage)
    await print.open(project.id, card.id)

    for (const n of [1, 2]) {
      await expect(print.reservedSelect(n).getByRole('option')).toHaveText(['画像', 'ID', 'みだし', 'メモ'])
    }
    await expect(print.reservedSelect(1).locator('option:checked')).toHaveText('画像')
    await expect(print.reservedSelect(2).locator('option:checked')).toHaveText('メモ')
  })

  test('表示している項目が無ければ、固定領域2 の初期値は ID', { tag: ['@TC-PG-PRINT-CONF3'] }, async ({ ownerPage, ownerApi, project }) => {
    for (const field of await ownerApi.fields(project.id)) await ownerApi.setFieldVisible(project.id, field.id, false)
    const card = await ownerApi.addCard(project.id)
    const print = new PrintViewPage(ownerPage)
    await print.open(project.id, card.id)

    await expect(print.reservedSelect(2).locator('option:checked')).toHaveText('ID')
    await expect(print.area(print.card(), 2)).toContainText(`ID ${card.id}`)
  })

  test('固定領域で内容を選ぶと、その内容を移し、それまでの内容は任意項目に表示で移す', { tag: ['@TC-PG-PRINT-CONF4', '@TC-PG-PRINT-CONF10'] }, async ({ ownerPage, ownerApi, project }) => {
    const card = await ownerApi.addCard(project.id, { みだし: '見出しの値', メモ: 'メモの値' })
    await addImageByApi(ownerPage, project.id, card.id)
    const print = new PrintViewPage(ownerPage)
    await print.open(project.id, card.id)
    const preview = print.card()
    await expect.poll(() => print.optionalNames()).toEqual(['ID', 'メモ'])

    await print.reservedSelect(2).selectOption({ label: 'メモ' })

    await expect(print.area(preview, 2)).toHaveText(/^\s*メモ\s*メモの値\s*$/)
    await expect.poll(() => print.optionalNames()).toEqual(['ID', 'みだし'])
    await expect(print.area(preview, 3)).toContainText('見出しの値')

    await print.reservedSelect(1).selectOption({ label: 'ID' })

    await expect(print.area(preview, 1)).toHaveText(new RegExp(`^\\s*ID\\s*${card.id}\\s*$`))
    await expect.poll(() => print.optionalNames()).toEqual(['画像', 'みだし'])
    await expect(print.photos(print.area(preview, 3))).toHaveCount(1)
  })

  test('別の固定領域で選んでいる内容を選ぶと、もとの固定領域は空になる', { tag: ['@TC-PG-PRINT-CONF5'] }, async ({ ownerPage, ownerApi, project }) => {
    const card = await ownerApi.addCard(project.id, { みだし: '見出しの値' })
    await addImageByApi(ownerPage, project.id, card.id)
    const print = new PrintViewPage(ownerPage)
    await print.open(project.id, card.id)
    const preview = print.card()

    await print.reservedSelect(2).selectOption({ label: '画像' })

    await expect(print.photos(print.area(preview, 2))).toHaveCount(1)
    await expect(print.photos(print.area(preview, 1))).toHaveCount(0)
    await expect(print.area(preview, 1)).toHaveText('')
    await expect(print.area(preview, 3)).toContainText('見出しの値')
  })

  test('固定領域の少ないレイアウトに変えるとあふれた内容を任意項目に移し、多いレイアウトに変えると任意項目の内容を 1 つ移す', { tag: ['@TC-PG-PRINT-CONF6', '@TC-PG-PRINT-CONF7'] }, async ({ ownerPage, ownerApi, project }) => {
    const card = await ownerApi.addCard(project.id, { みだし: '見出しの値' })
    const print = new PrintViewPage(ownerPage)
    await print.open(project.id, card.id)
    const preview = print.card()

    await print.layoutSelect.selectOption({ label: 'パターン2' })

    await expect.poll(() => print.optionalNames()).toEqual(['ID', 'みだし', 'メモ'])
    await expect(print.area(preview, 2)).toContainText('見出しの値')

    await print.layoutSelect.selectOption({ label: 'パターン3' })

    await expect(print.reservedSelects).toHaveCount(2)
    await expect.poll(() => print.optionalNames()).toHaveLength(2)
    const moved = await print.reservedSelect(2).locator('option:checked').textContent()
    expect(['ID', 'みだし', 'メモ']).toContain(moved)
    await expect.poll(() => print.optionalNames()).not.toContain(moved)
    await expect(print.area(preview, 2)).toContainText(moved!)
  })

  test('「任意項目」に固定領域で選んでいない内容を一覧し、表示／非表示を切り替える。初期値は非表示の項目だけ非表示', { tag: ['@TC-PG-PRINT-CONF8', '@TC-PG-PRINT-CONF9'] }, async ({ ownerPage, ownerApi, project }) => {
    const hidden = await ownerApi.addField(project.id, '非表示の項目')
    await ownerApi.setFieldVisible(project.id, hidden.id, false)
    const card = await ownerApi.addCard(project.id, { みだし: '見出しの値', メモ: 'メモの値', 非表示の項目: '隠した値' })
    const print = new PrintViewPage(ownerPage)
    await print.open(project.id, card.id)
    const unreserved = print.area(print.card(), 3)

    await expect.poll(() => print.optionalNames()).toEqual(['ID', 'メモ', '非表示の項目'])
    await expect(unreserved).toContainText(`ID ${card.id}`)
    await expect(unreserved).toContainText('メモの値')
    await expect(unreserved).not.toContainText('隠した値')

    await print.optionalToggle('非表示の項目').click()
    await expect(unreserved).toContainText('隠した値')

    await print.optionalToggle('メモ').click()
    await expect(unreserved).not.toContainText('メモの値')
    await print.optionalToggle('ID').click()
    await expect(unreserved).not.toContainText('ID')
  })

  test('「表示画像枚数」で載せる画像の枚数を選び、0 はすべての画像（初期値 0）', { tag: ['@TC-PG-PRINT-CONF11'] }, async ({ ownerPage, ownerApi, project }) => {
    const card = await ownerApi.addCard(project.id)
    for (const file of ['red.png', 'blue.png', 'green.png']) await addImageByApi(ownerPage, project.id, card.id, file)
    const print = new PrintViewPage(ownerPage)
    await print.open(project.id, card.id)
    const area = print.area(print.card(), 1)
    await expect(print.imageCountInput).toHaveValue('0')
    await expect(print.photos(area)).toHaveCount(3)

    await print.imageCountInput.fill('2')
    await expect(print.photos(area)).toHaveCount(2)

    await print.imageCountInput.fill('0')
    await expect(print.photos(area)).toHaveCount(3)
  })

  test('「一行あたりの表示画像枚数」で画像を横に並べる枚数を選び、0 はすべて 1 行に並べる（初期値 0）', { tag: ['@TC-PG-PRINT-CONF12'] }, async ({ ownerPage, ownerApi, project }) => {
    const card = await ownerApi.addCard(project.id)
    for (const file of ['red.png', 'blue.png', 'green.png']) await addImageByApi(ownerPage, project.id, card.id, file)
    const print = new PrintViewPage(ownerPage)
    await print.open(project.id, card.id)
    const photos = print.photos(print.area(print.card(), 1))
    await expect(print.rowImageCountInput).toHaveValue('0')
    await expect(photos).toHaveCount(3)
    const tops = async () => {
      const boxes = await Promise.all([0, 1, 2].map(async (i) => await box(photos.nth(i))))
      return boxes.map((b) => b.y + b.height / 2)
    }
    const lefts = async () => (await Promise.all([0, 1, 2].map(async (i) => await box(photos.nth(i))))).map((b) => b.x)

    // 0: 3 枚とも同じ行で、左から並ぶ
    await expect.poll(async () => { const t = await tops(); return near(t[0], t[1]) && near(t[1], t[2]) }).toBe(true)
    const l = await lefts()
    expect(l[0]).toBeLessThan(l[1])
    expect(l[1]).toBeLessThan(l[2])

    await print.rowImageCountInput.fill('1')

    // 1: 1 枚ずつ縦に並ぶ
    await expect.poll(async () => { const t = await tops(); return t[0] < t[1] && t[1] < t[2] }).toBe(true)
    await expect.poll(async () => { const x = await lefts(); return near(x[0], x[1]) && near(x[1], x[2]) }).toBe(true)
  })

  test('設定は同じプロジェクトのカード印刷ビューを移っても保持し、再読み込みすると初期値に戻る', { tag: ['@TC-PG-PRINT-CONF13', '@TC-PG-PRINT-CONF14'] }, async ({ ownerPage, ownerApi, project }) => {
    const c1 = await ownerApi.addCard(project.id)
    const c2 = await ownerApi.addCard(project.id)
    const print = new PrintViewPage(ownerPage)
    const view = new CardViewPage(ownerPage)
    await print.open(project.id, c1.id)
    await print.layoutSelect.selectOption({ label: 'パターン3' })
    await print.reservedSelect(1).selectOption({ label: 'ID' })
    await print.imageCountInput.fill('2')

    // 別のカードのカード印刷ビュー
    await print.cardViewLink.click()
    await view.nextLink.click()
    await expect(view.idValue).toHaveText(`ID${c2.id}`)
    await view.printViewLink.click()
    await expect(print.card()).toContainText(`ID ${c2.id}`)
    await expect(print.layoutSelect.locator('option:checked')).toHaveText('パターン3')
    await expect(print.reservedSelect(1).locator('option:checked')).toHaveText('ID')
    await expect(print.imageCountInput).toHaveValue('2')

    // すべてのカードのカード印刷ビュー
    await print.tableViewLink.click()
    await expect(ownerPage).toHaveURL(new RegExp(`/projects/${project.id}\\?`))
    await ownerPage.getByRole('link', { name: 'カード印刷ビュー' }).click()
    await expect(print.cards).toHaveCount(2)
    await expect(print.layoutSelect.locator('option:checked')).toHaveText('パターン3')

    await ownerPage.reload()
    await expect(print.cards).toHaveCount(2)
    await expect(print.layoutSelect.locator('option:checked')).toHaveText('パターン1')
    await expect(print.reservedSelect(1).locator('option:checked')).toHaveText('画像')
    await expect(print.imageCountInput).toHaveValue('0')
  })

  test('【既知の問題】任意項目で非表示にした内容を固定領域で選ぶと、固定領域に何も表示しない（あるべき: 固定領域に表示する）', { annotation: [knownIssue('docs/ISSUES.md', 'カード印刷ビューで非表示の内容を固定領域に選ぶと表示しない')] }, async ({ ownerPage, ownerApi, project }) => {
    const card = await ownerApi.addCard(project.id, { みだし: '見出しの値' })
    const print = new PrintViewPage(ownerPage)
    await print.open(project.id, card.id)
    const preview = print.card()
    await print.optionalToggle('ID').click()
    await expect(print.area(preview, 3)).not.toContainText('ID')

    await print.reservedSelect(2).selectOption({ label: 'ID' })

    await expect(print.reservedSelect(2).locator('option:checked')).toHaveText('ID')
    await expect(print.area(preview, 3)).toContainText('見出しの値')
    await expect(print.area(preview, 2)).toHaveText('')
  })

  test('【既知の問題】カード印刷ビューを開いた後に追加した項目は、任意項目に表示で一覧されるが印刷に載らない（あるべき: 印刷に載る）', { annotation: [knownIssue('docs/ISSUES.md', 'カード印刷ビューを開いた後に追加した項目を印刷できない')] }, async ({ ownerPage, ownerApi, project, tag }) => {
    const card = await ownerApi.addCard(project.id)
    const print = new PrintViewPage(ownerPage)
    const view = new CardViewPage(ownerPage)
    await print.open(project.id, card.id)

    // 印刷の設定を作った後に、カード入力ビューで項目を追加して値を入れる
    await print.cardViewLink.click()
    await view.addFieldButton.click()
    await view.newFieldInput.fill(`追加した項目${tag}`)
    await view.newFieldSubmit.click()
    await view.field(`追加した項目${tag}`).fill('追加した値')
    await expect(view.savedIcon).toHaveCSS('opacity', '1')
    await view.printViewLink.click()
    const preview = print.card()
    await expect(print.printButton).toBeVisible()

    // 任意項目の一覧は「印刷」ボタンより後に描画されることがあるので、読み直して待つ
    await expect.poll(() => print.optionalNames()).toContain(`追加した項目${tag}`)
    await expect(preview).not.toContainText('追加した値')
    await print.optionalToggle(`追加した項目${tag}`).click()
    await expect(preview).not.toContainText('追加した値')
    await print.reservedSelect(2).selectOption({ label: `追加した項目${tag}` })
    await expect(print.area(preview, 2)).toHaveText('')

    // 再読み込みすると設定を作り直すので、印刷に載る
    await ownerPage.reload()
    await expect(print.card()).toContainText('追加した値')
  })
})

test.describe('印刷', () => {
  test('「印刷」ボタンを表示する。印刷では画面のヘッダーと設定を印刷せず、A4 縦の用紙 1 枚にカードを 2 枚ずつ上下半分に分けて印刷する', { tag: ['@TC-PG-PRINT-PRT2', '@TC-PG-PRINT-PRT3', '@TC-PG-PRINT-PRT4'] }, async ({ ownerPage, ownerApi, project }) => {
    for (const name of ['カード1', 'カード2', 'カード3']) await ownerApi.addCard(project.id, { みだし: name })
    const print = new PrintViewPage(ownerPage)
    await print.open(project.id)
    await expect(print.printButton).toBeVisible()
    await expect(print.cards).toHaveCount(3)

    await ownerPage.emulateMedia({ media: 'print' })

    await expect(print.text(project.name)).toBeHidden()
    await expect(print.tableViewLink).toBeHidden()
    await expect(print.printButton).toBeHidden()
    await expect(print.layoutSelect).toBeHidden()
    await expect(print.cards).toHaveCount(3)
    await expect(print.sheets).toHaveCount(2)
    const [sheet1, sheet2] = [await box(print.sheets.nth(0)), await box(print.sheets.nth(1))]
    const [card1, card2, card3] = [await box(print.card(0)), await box(print.card(1)), await box(print.card(2))]
    // 1 枚目の用紙: 上半分に 1 枚目、下半分に 2 枚目
    expect(card1.y + card1.height).toBeLessThanOrEqual(sheet1.y + sheet1.height / 2 + 1)
    expect(card2.y).toBeGreaterThanOrEqual(sheet1.y + sheet1.height / 2 - 1)
    expect(card2.y + card2.height).toBeLessThanOrEqual(sheet1.y + sheet1.height + 1)
    // 2 枚目の用紙: 上半分だけ
    expect(card3.y).toBeGreaterThanOrEqual(sheet2.y - 1)
    expect(card3.y + card3.height).toBeLessThanOrEqual(sheet2.y + sheet2.height / 2 + 1)
    await expect(print.card(0)).toContainText('カード1')
    await expect(print.card(2)).toContainText('カード3')

    // PDF にすると A4 縦（595×842pt）の 2 ページになる
    const pdf = (await ownerPage.pdf({ preferCSSPageSize: true })).toString('latin1')
    const pages = [...pdf.matchAll(/\/Type\s*\/Page(?![s\w])/g)]
    console.log('PDF', pages.length, pdf.match(/\/MediaBox\s*\[[^\]]*\]/g))
    expect(pages).toHaveLength(2)
    for (const mediaBox of pdf.match(/\/MediaBox\s*\[[^\]]*\]/g) ?? []) {
      const [, , w, h] = mediaBox.replace(/.*\[/, '').replace(']', '').trim().split(/\s+/).map(Number)
      expect(Math.round(w)).toBe(595)
      expect(Math.round(h)).toBe(842)
    }
  })
})

test.describe('ユーザーストーリー', () => {
  test('研究者がテーブルビューからすべてのカードを紙に印刷し、後で紙のカードの QR コードをスキャンすると、そのカードのカード入力ビューにたどり着き、撮った写真がカードに添えられる', { tag: ['@story', '@TC-PG-PRINT-US1'] }, async ({ ownerPage, ownerApi, project }) => {
    const cards = []
    for (const name of ['資料1', '資料2', '資料3']) cards.push(await ownerApi.addCard(project.id, { みだし: name }))
    const table = new TableViewPage(ownerPage)
    const print = new PrintViewPage(ownerPage)
    const view = new CardViewPage(ownerPage)
    await table.open(project.id)

    // すべてのカードを印刷する
    await table.printViewLink.click()
    await expect(print.printButton).toBeVisible()
    await expect(print.cards).toHaveCount(3)
    await ownerPage.emulateMedia({ media: 'print' })
    await expect(print.cards).toHaveCount(3)
    for (const [i, name] of ['資料1', '資料2', '資料3'].entries()) {
      await expect(print.card(i)).toContainText(name)
      await expect(print.qrCode(print.card(i))).toHaveCount(1)
    }
    const pdf = await print.printedPdf()
    expect(pdf.pageCount).toBe(2)
    for (const size of pdf.sizes) expect(size).toEqual([595, 842])

    // 印刷した 2 枚目のカードを、資料と一緒に撮影する（印刷した QR コードを画像にする）
    const photo = await print.photoOfCard(print.card(1), '#a16207')
    await ownerPage.emulateMedia({ media: 'screen' })

    // 後で、撮った写真をテーブルビューからスキャンする
    await print.tableViewLink.click()
    await table.table.waitFor()
    await new ScanButton(ownerPage).scan(photo)

    await expect(ownerPage).toHaveURL(`/projects/${project.id}/cards/${cards[1].id}`)
    await expect(view.toast(`ID: ${cards[1].id}のカードに画像を追加しました`)).toBeVisible()
    await expect(view.idValue).toHaveText(`ID${cards[1].id}`)
    await expect(view.field('みだし')).toHaveValue('資料2')
    await expect(view.images).toHaveCount(1)
    const images = await Promise.all(cards.map(async (c) => (await getCardByApi(ownerPage, project.id, c.id)).images.length))
    expect(images).toEqual([0, 1, 0])
  })

  test('研究者がレイアウト・固定領域の項目・任意項目・画像の枚数を選んで 1 枚目のカードを印刷し、次のカードに移っても設定し直さずに同じ体裁で印刷できる', { tag: ['@story', '@TC-PG-PRINT-US2'] }, async ({ ownerPage, ownerApi, project }) => {
    const c1 = await ownerApi.addCard(project.id, { みだし: '見出し1', メモ: 'メモ1' })
    const c2 = await ownerApi.addCard(project.id, { みだし: '見出し2', メモ: 'メモ2' })
    for (const card of [c1, c2]) {
      for (const file of ['red.png', 'blue.png', 'green.png']) await addImageByApi(ownerPage, project.id, card.id, file)
    }
    const view = new CardViewPage(ownerPage)
    const print = new PrintViewPage(ownerPage)
    await view.open(project.id, c1.id)
    await view.printViewLink.click()
    await expect(print.printButton).toBeVisible()

    // 資料に合わせて体裁を選ぶ: パターン3、固定領域2 はメモ、ID は載せない、画像は 2 枚まで
    await print.layoutSelect.selectOption({ label: 'パターン3' })
    await print.reservedSelect(2).selectOption({ label: 'メモ' })
    await expect.poll(() => print.optionalNames()).toEqual(['ID', 'みだし'])
    await print.optionalToggle('ID').click()
    await print.imageCountInput.fill('2')

    /** 選んだ体裁で、そのカードを載せていること */
    const expectLayout = async (no: number) => {
      const card = print.card()
      await expect(print.areas(card)).toHaveCount(3)
      await expect(print.photos(print.area(card, 1))).toHaveCount(2)
      await expect(print.area(card, 2)).toHaveText(new RegExp(`^\\s*メモ\\s*メモ${no}\\s*$`))
      await expect(print.area(card, 3)).toContainText(`見出し${no}`)
      await expect(print.area(card, 3)).not.toContainText('ID')
      await expect(print.qrCode(print.area(card, 3))).toHaveCount(1)
    }
    await expectLayout(1)
    await ownerPage.emulateMedia({ media: 'print' })
    await expectLayout(1)
    await ownerPage.emulateMedia({ media: 'screen' })

    // 次のカードに移って印刷する
    await print.cardViewLink.click()
    await view.nextLink.click()
    await expect(view.idValue).toHaveText(`ID${c2.id}`)
    await view.printViewLink.click()
    await expect(print.card()).toContainText('見出し2')

    // 設定し直さなくても、同じ体裁のまま
    await expect(print.layoutSelect.locator('option:checked')).toHaveText('パターン3')
    await expect(print.reservedSelect(2).locator('option:checked')).toHaveText('メモ')
    await expect(print.imageCountInput).toHaveValue('2')
    await expectLayout(2)
    await ownerPage.emulateMedia({ media: 'print' })
    await expectLayout(2)
  })

  test('研究者が内容の量が違うカードを 4 枚印刷すると、A4 縦の用紙 2 枚に 2 枚ずつ、同じ高さで上下半分ずつに分けて印刷される', { tag: ['@story', '@TC-PG-PRINT-US3'] }, async ({ ownerPage, ownerApi, project }) => {
    // 内容の多いカード（長いメモと画像 3 枚）と、空のカードを混ぜる
    const long = await ownerApi.addCard(project.id, { みだし: '内容の多いカード', メモ: Array.from({ length: 80 }, (_, i) => `${i + 1}行目`).join('\n') })
    for (const file of ['red.png', 'blue.png', 'green.png']) await addImageByApi(ownerPage, project.id, long.id, file)
    await ownerApi.addCard(project.id)
    await ownerApi.addCard(project.id, { みだし: '見出しだけのカード' })
    const withImages = await ownerApi.addCard(project.id, { みだし: '画像のカード' })
    for (const file of ['blue.png', 'red.png']) await addImageByApi(ownerPage, project.id, withImages.id, file)
    const table = new TableViewPage(ownerPage)
    const print = new PrintViewPage(ownerPage)
    await table.open(project.id)
    await table.printViewLink.click()
    await expect(print.cards).toHaveCount(4)

    await ownerPage.emulateMedia({ media: 'print' })

    await expect(print.cards).toHaveCount(4)
    await expect(print.sheets).toHaveCount(2)
    for (const s of [0, 1]) {
      const sheet = await box(print.sheets.nth(s))
      const [top, bottom] = [await box(print.card(s * 2)), await box(print.card(s * 2 + 1))]
      const half = sheet.y + sheet.height / 2
      // 上のカードは用紙の上端から半分まで、下のカードは半分から下端まで
      expect(near(top.y, sheet.y)).toBe(true)
      expect(top.y + top.height).toBeLessThanOrEqual(half + 1)
      expect(bottom.y).toBeGreaterThanOrEqual(half - 1)
      expect(near(bottom.y + bottom.height, sheet.y + sheet.height)).toBe(true)
      // 内容の量にかかわらず、2 枚は同じ高さ
      expect(near(top.height, bottom.height)).toBe(true)
    }
    await expect(print.card(0)).toContainText('内容の多いカード')
    await expect(print.card(3)).toContainText('画像のカード')

    const pdf = await print.printedPdf()
    expect(pdf.pageCount).toBe(2)
    for (const size of pdf.sizes) expect(size).toEqual([595, 842])
  })
})
