import { createDeflateRaw, crc32, deflateRawSync } from 'node:zlib'
import type { Page } from '@playwright/test'
import { expect, test } from '../../fixtures'
import { IMPORT_TIMEOUT } from '../../support/imports'
import {
  addImage,
  fileOf,
  MIME,
  ProjectScreen,
  ProjectSettingsPage,
  uploadImport,
  type ImportFile,
} from '../../pages/ProjectSettingsPage'
import { knownIssue, spec, withIssue } from '../../support/spec'

// インポートは毎分 0 秒に動く定期の処理が 1 件ずつ取り込む。結果は画面で待つ（1 件あたり最大 1 分あまり）

const RED = 'rgb(239, 68, 68)'
const GREEN = 'rgb(34, 197, 94)'

/** テーブルビューの行を「並び順・ID・表示している項目の値」で確かめる */
async function expectCards(screen: ProjectScreen, rows: { order?: string, id: string, values: string[] }[]) {
  await expect(screen.cardRows).toHaveCount(rows.length)
  for (const [i, row] of rows.entries()) {
    const locator = screen.cardRows.nth(i)
    await expect(screen.idCell(locator), `${i + 1} 行目の ID`).toHaveText(row.id)
    if (row.order !== undefined) await expect(screen.orderCell(locator), `${i + 1} 行目の並び順`).toHaveText(row.order)
    await expect(screen.values(locator)).toHaveCount(row.values.length)
    for (const [j, value] of row.values.entries()) {
      await expect(screen.values(locator).nth(j), `ID ${row.id} の ${j + 1} 番目の値`).toHaveValue(value)
    }
  }
}

/** テーブルビューの見出しが、この名前だけをこの順に並べていること */
async function expectHeaders(screen: ProjectScreen, names: string[]) {
  await expect(screen.headerRow).toHaveText(new RegExp(`^\\s*${names.join('\\s*')}\\s*$`))
}

/** 縮小した画像の大きさ（読み込みを待つ） */
async function imageSizes(page: Page) {
  const images = page.getByRole('img')
  const count = await images.count()
  const sizes: [number, number][] = []
  for (let i = 0; i < count; i++) {
    await expect.poll(() => images.nth(i).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
    sizes.push(await images.nth(i).evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight] as [number, number]))
  }
  return sizes
}

/** 行を開いて、記録したエラーの内容を読む */
async function errorMessage(settings: ProjectSettingsPage, filename: string) {
  const row = settings.historyRow(filename)
  await settings.expandButton(row).click()
  // 開いた行は、ファイルの行のすぐ下に出る（pre で改行を保って表示する）
  const detail = settings.historyTable.getByRole('row').filter({ has: settings.page.locator('pre') })
  await expect(detail).toBeVisible()
  const text = await detail.innerText()
  await settings.expandButton(row).click()
  await expect(detail).toHaveCount(0)
  return text.trim()
}

/**
 * 展開に時間がかかる zip（中身がすべて 0 の大きなファイルと CSV）。取り込み中（インポート中）を画面で捉えるために使う
 * 圧縮すると小さいので、テストの中で作る
 */
async function slowZip(csv: string, zeroBytes = 1024 * 1024 * 1024): Promise<Buffer> {
  type Entry = { name: string, crc: number, size: number, data: Buffer }
  const entries: Entry[] = []

  const chunk = Buffer.alloc(1024 * 1024)
  const deflate = createDeflateRaw({ level: 9 })
  const parts: Buffer[] = []
  deflate.on('data', (data: Buffer) => parts.push(data))
  const done = new Promise((resolve) => deflate.on('end', resolve))
  let crc = 0
  for (let written = 0; written < zeroBytes; written += chunk.length) {
    crc = crc32(chunk, crc)
    if (!deflate.write(chunk)) await new Promise((resolve) => deflate.once('drain', resolve))
  }
  deflate.end()
  await done
  entries.push({ name: 'zeros.bin', crc, size: zeroBytes, data: Buffer.concat(parts) })
  const csvData = Buffer.from(csv)
  entries.push({ name: 'cards.csv', crc: crc32(csvData), size: csvData.length, data: deflateRawSync(csvData) })

  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  for (const entry of entries) {
    const name = Buffer.from(entry.name)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6) // ファイル名は UTF-8
    local.writeUInt16LE(8, 8) // deflate
    local.writeUInt32LE(entry.crc >>> 0, 14)
    local.writeUInt32LE(entry.data.length, 18)
    local.writeUInt32LE(entry.size, 22)
    local.writeUInt16LE(name.length, 26)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x0800, 8)
    central.writeUInt16LE(8, 10)
    central.writeUInt32LE(entry.crc >>> 0, 16)
    central.writeUInt32LE(entry.data.length, 20)
    central.writeUInt32LE(entry.size, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt32LE(offset, 42)
    locals.push(local, name, entry.data)
    centrals.push(central, name)
    offset += local.length + name.length + entry.data.length
  }
  const centralSize = centrals.reduce((n, b) => n + b.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, ...centrals, end])
}

test.describe('インポート', () => {
  test('CSV を上書きせずに取り込むと、すべての行を新しいカードとして末尾に追加し、ID を振り直す。待っている間はダイアログを表示し、終わると自動で閉じてオーナーに完了を表示する', spec('features/import-export.md',
    'インポート > インポートできるのは、エクセル（xlsx）、CSV（UTF-8）、zip のファイルとする',
    'インポート > WHERE エクセル・CSV の場合、最初のシートの表を取り込む > 1 行目を項目名、2 行目以降をカードとする',
    'インポート > WHERE エクセル・CSV の場合 > 表の途中の空の行も、値が空のカードとして取り込む',
    'インポート > WHERE エクセル・CSV の場合 > WHERE 項目名がプロジェクトに無い場合、その項目を末尾に追加する',
    'インポート > WHERE エクセル・CSV の場合 > WHERE プロジェクトにある項目がファイルに無い場合',
    'インポート > WHERE エクセル・CSV の場合 > 「ID」の列は項目にせず',
    'インポート > WHERE エクセル・CSV の場合 > 「画像ファイル」の列は項目にしない',
    'インポート > WHERE エクセル・CSV の場合 > 新しいカードは、ファイルの行の順に、プロジェクトの末尾に置く',
    'インポート > 「ID」の列は、「同じIDのカードを上書きする」のチェックで扱いが変わる',
    'インポート > しない | どれでも | 新しいカードを作る',
    'インポート > 新しく振るカードの ID は',
    'インポート > 結果はプロジェクト設定のインポート履歴と、オーナーのテーブルビューに表示する',
    'インポート中の画面 > WHILE プロジェクトのインポートを待っている間・取り込んでいる間は',
    'インポート中の画面 > WHILE プロジェクトのインポートを待っている間 > 30 秒ごとに',
    'インポート中の画面 > WHILE プロジェクトのインポートを待っている間 > WHEN インポートが終わると',
    'pages/project-settings.md > インポート > WHEN 「インポート」を押すと、ファイルをアップロードしてインポートを始め',
    'pages/project-settings.md > インポート > WHEN 「インポート」を押すと > 取り込みの内容は',
    'pages/project-settings.md > インポート > WHEN 「インポート」を押すと > WHILE 「同じIDのカードを上書きする」をチェックしている間は',
    'pages/project-settings.md > インポート > 取り込みが終わった | インポート済（緑）',
  ), async ({ ownerPage, ownerApi, project, newAccount, apiAs, pageAs }) => {
    await ownerApi.addCard(project.id, { みだし: '既存1', メモ: 'メモ1' })
    await ownerApi.addCard(project.id, { みだし: '既存2', メモ: 'メモ2' })
    const editor = await newAccount({ suffix: 'editor' })
    await ownerApi.invite(project.id, editor.username!)
    await (await apiAs(editor)).accept(project.id, editor.id)

    // （BOM 付きの UTF-8）ID,みだし,新項目,画像ファイル / 99,行1,新1,無い画像.png / ,,, / 7,行3,新3,
    const settings = new ProjectSettingsPage(ownerPage, project.id)
    await settings.open('インポート')
    await settings.chooseFile(await fileOf('cards.csv', MIME.csv))
    await settings.startImport()

    const screen = new ProjectScreen(ownerPage, project.id)
    await expect(ownerPage).toHaveURL(`/projects/${project.id}`)
    await expect(screen.importingDialog).toBeVisible()
    await expect(screen.importingMessage).toContainText('にアップロードされた cards.csv を処理中です。')
    await expect(screen.table).toHaveCount(0)

    const editorScreen = new ProjectScreen(await pageAs(editor), project.id)
    await editorScreen.openTableView()
    await expect(editorScreen.importingDialog).toBeVisible()

    // 「再読み込み」を押さずに待つ（30 秒ごとに自動で確かめて閉じる）
    await screen.waitForImportDone()

    await expect(screen.importedAlert).toBeVisible()
    // 「ID」「画像ファイル」の列は項目にしない
    await expectHeaders(screen, ['並び順', 'ID', 'みだし', 'メモ', '新項目'])
    await expectCards(screen, [
      { order: '1', id: '1', values: ['既存1', 'メモ1', ''] },
      { order: '2', id: '2', values: ['既存2', 'メモ2', ''] },
      // ID は、プロジェクト（2）とファイルの ID の列（99・7）のいちばん大きい数字の次から振る
      { order: '3', id: '100', values: ['行1', '', '新1'] },
      { order: '4', id: '101', values: ['', '', ''] },
      { order: '5', id: '102', values: ['行3', '', '新3'] },
    ])

    // 編集者のテーブルビューには結果を表示しない
    await editorScreen.waitForImportDone()
    await expect(editorScreen.cardRows).toHaveCount(5)
    await expect(editorScreen.importedAlert).toHaveCount(0)

    // 「詳細」でインポート履歴を開く
    await ownerPage.getByRole('link', { name: '詳細' }).click()
    await expect(ownerPage).toHaveURL(`/projects/${project.id}/settings/import`)
    const row = settings.historyRow('cards.csv')
    await expect(settings.historyCell(row, '結果')).toHaveText('インポート済')
    await expect(settings.historyCell(row, '結果').getByText('インポート済')).toHaveCSS('color', GREEN)
    await expect(settings.expandButton(row)).toBeHidden()
  })

  test('zip（エクセル・画像）を上書きして取り込むと、同じ ID のカードの値と画像を置き換え、無い ID・空の ID は新しいカードにする', spec('features/import-export.md',
    'インポート > WHERE zip の場合、中のエクセルまたは CSV のファイル 1 つを、上と同じように取り込む',
    'インポート > WHERE zip の場合 > エクセル・CSV のファイルは、名前が .xlsx・.csv（小文字）で終わるものを探す',
    'インポート > WHERE zip の場合 > WHERE 「画像ファイル」の列がある場合',
    'インポート > WHERE zip の場合 > WHERE 「画像ファイル」の列がある場合 > ファイル名は、zip のいちばん上からのパスで書く',
    'インポート > WHERE zip の場合 > WHERE 「画像ファイル」の列がある場合 > ファイル名は、空白または改行で区切って複数書ける',
    'インポート > WHERE zip の場合 > WHERE 「画像ファイル」の列がある場合 > WHERE 列が空の場合、そのカードの画像を消す',
    'インポート > する | 空 | 新しいカードを作る',
    'インポート > する | 数字で、その ID のカードがある',
    'インポート > する | 数字で、その ID のカードが無い',
    'インポート > 新しく振るカードの ID は',
    'pages/project-settings.md > インポート > WHEN 「インポート」を押すと > WHILE 「同じIDのカードを上書きする」をチェックしている間は',
  ), async ({ ownerPage, owner, ownerApi, project }) => {
    const wide = await fileOf('wide.png', MIME.png)
    const small = await fileOf('small.png', MIME.png)
    const cards = [
      await ownerApi.addCard(project.id, { みだし: '一', メモ: 'メモ一' }),
      await ownerApi.addCard(project.id, { みだし: '二', メモ: 'メモ二' }),
      await ownerApi.addCard(project.id, { みだし: '三', メモ: 'メモ三' }),
    ]
    await addImage(owner, project.id, cards[0].id, small)
    await addImage(owner, project.id, cards[1].id, small)
    await addImage(owner, project.id, cards[2].id, wide)

    // data.xlsx: ID,みだし,メモ,画像ファイル
    //   1,一改,(空),"img/wide.png⏎small.jpeg" / 2,二改,メモ二改,(空) / (空),新規,(空),"img/wide.png small.jpeg" / 50,五十,(空),(空)
    // ほかに __MACOSX/._data.xlsx と NOTES.CSV（無視する）。small.jpeg の中身は PNG
    const settings = new ProjectSettingsPage(ownerPage, project.id)
    await settings.open('インポート')
    await settings.chooseFile(await fileOf('update.zip', MIME.zip))
    await settings.checkUpdate()
    await settings.startImport()

    const screen = new ProjectScreen(ownerPage, project.id)
    await expect(screen.importingDialog).toBeVisible()
    await screen.waitForImportDone()

    await expect(screen.importedAlert).toBeVisible()
    await expectHeaders(screen, ['並び順', 'ID', 'みだし', 'メモ'])
    await expectCards(screen, [
      // 上書きしたカードの並び順は変えない。空のセルは値を空にする
      { order: '1', id: '1', values: ['一改', ''] },
      { order: '2', id: '2', values: ['二改', 'メモ二改'] },
      { order: '3', id: '3', values: ['三', 'メモ三'] },
      // 空の ID は、プロジェクト（3）とファイルの ID の列（50）のいちばん大きい数字の次。新しいカードはファイルの行の順に末尾
      { id: '51', values: ['新規', ''] },
      { id: '50', values: ['五十', ''] },
    ])

    // 画像: 1 は列の 2 つ（改行区切り。フォルダの中の画像を含む）に置き換え、2 は列が空なので消え、3 はファイルに無いので変えない
    const expected: [number, [number, number][]][] = [
      [1, [[640, 320], [100, 50]]],
      [2, []],
      [3, [[640, 320]]],
      [51, [[640, 320], [100, 50]]], // 空白区切り
      [50, []],
    ]
    for (const [cardId, sizes] of expected) {
      await screen.openCard(cardId)
      await expect(ownerPage.getByRole('button', { name: '画像を追加' })).toBeVisible()
      await expect(ownerPage.getByRole('img'), `カード ${cardId} の画像`).toHaveCount(sizes.length)
      expect(await imageSizes(ownerPage), `カード ${cardId} の画像`).toEqual(sizes)
    }
  })

  test('【実装との乖離】オーナー以外（編集者）も URL を直接開いて取り込める。「画像ファイル」の列が無い zip は、上書きしても画像を変えない（あるべき: オーナーだけがインポートできる）', withIssue(
    spec('features/import-export.md',
      'インポート > WHERE zip の場合 > WHERE 「画像ファイル」の列が無い場合、画像は変えない',
      'インポート > WHERE zip の場合、中のエクセルまたは CSV のファイル 1 つを、上と同じように取り込む',
    ),
    knownIssue('pages/project-settings.md', 'オーナー以外にはタブを表示しないが、URL を直接開くと「インポート」「ユーザー管理」「プロジェクト削除」の画面を表示する。（略）インポートはサーバー側のオーナー判定が効いておらず、取り込めてしまう'),
  ), async ({ owner, ownerApi, project, newAccount, apiAs, pageAs }) => {
    const card = await ownerApi.addCard(project.id, { みだし: '元の値' })
    await addImage(owner, project.id, card.id, await fileOf('small.png', MIME.png))
    const editor = await newAccount({ suffix: 'editor' })
    await ownerApi.invite(project.id, editor.username!)
    await (await apiAs(editor)).accept(project.id, editor.id)
    const editorPage = await pageAs(editor)

    // cards.csv: ID,みだし / 1,編集者が上書き
    const settings = new ProjectSettingsPage(editorPage, project.id)
    await settings.open('インポート')
    await settings.chooseFile(await fileOf('no-image-column.zip', MIME.zip))
    await settings.checkUpdate()
    await settings.startImport()

    const screen = new ProjectScreen(editorPage, project.id)
    await expect(screen.importingDialog).toBeVisible()
    await screen.waitForImportDone()

    await expectCards(screen, [{ order: '1', id: '1', values: ['編集者が上書き', ''] }])
    await screen.openCard(1)
    await expect(editorPage.getByRole('img')).toHaveCount(1)
    expect(await imageSizes(editorPage)).toEqual([[100, 50]])
  })

  test('ファイルに誤りがあると、何も取り込まずフォーマットエラー（赤）とし、行を開くと記録した内容を表示する。インポートは毎分 0 秒に、アップロードの古い順に 1 件ずつ取り込む', spec('features/import-export.md',
    'インポート > アップロードしたファイルは、すぐには取り込まず、毎分 0 秒に動く処理が順に取り込む',
    'インポート > アップロードしたファイルは > 取り込むのは、すべてのプロジェクトを通じて、アップロードの古い順に 1 件ずつとする',
    'インポート > IF ファイルに次の誤りがある場合、何も取り込まず',
    'インポート > ID が数字でない行がある（上書きしない場合も確かめる）',
    'インポート > 「画像ファイル」の列に書いた画像が zip に無い',
    'インポート > zip を展開できない',
    'インポート > zip にエクセル・CSV が 2 つ以上ある',
    'インポート > 行ごとの誤り（ID・画像ファイル）は、すべての行を確かめ',
    'インポート > 結果はプロジェクト設定のインポート履歴と、オーナーのテーブルビューに表示する',
    'features/non-functional.md > インポートの処理 > インポートは、毎分 0 秒に動く処理が',
    'pages/project-settings.md > インポート > インポートを待っている | 未処理',
    'pages/project-settings.md > インポート > ファイルの形式・内容に誤りがあった | フォーマットエラー（赤）',
    'pages/project-settings.md > インポート > WHERE 結果がフォーマットエラー・システムエラーの場合',
  ), async ({ ownerPage, owner, ownerApi, project, tag }) => {
    test.setTimeout(8 * 60_000)
    await ownerApi.addCard(project.id, { みだし: '元のカード' })
    const settings = new ProjectSettingsPage(ownerPage, project.id)
    // インポートを待っている間はプロジェクトの画面を開けないので、先に開いておき、画面の中の遷移で読み直す
    await settings.open('インポート')

    // rows.csv: ID,みだし,新しい列,画像ファイル / x1,a,a,missing.png / 2,b,b,ok.png / y,c,c,
    const files: ImportFile[] = [
      { ...await fileOf('row-errors.zip', MIME.zip), name: `${tag}-1-row-errors.zip` },
      { ...await fileOf('broken.zip', MIME.zip), name: `${tag}-2-broken.zip` },
      { ...await fileOf('two-tables.zip', MIME.zip), name: `${tag}-3-two-tables.zip` },
    ]
    for (const file of files) await uploadImport(owner, project.id, file)
    const [first, second, third] = files.map((f) => f.name)

    await settings.reloadHistory()
    for (const name of [first, second, third]) {
      await expect(settings.historyCell(settings.historyRow(name), '結果')).toHaveText('未処理')
    }

    // 古い順に 1 件ずつ。前のインポートが終わっても、次は次の分まで始めない
    await settings.waitForImportResult(first)
    const finishedAt = new Date()
    await expect(settings.historyCell(settings.historyRow(second), '結果')).toHaveText('未処理')
    await expect(settings.historyCell(settings.historyRow(third), '結果')).toHaveText('未処理')
    // 毎分 0 秒に動く（画面で読み直す間隔のぶん遅れて気づく）
    expect(finishedAt.getSeconds(), finishedAt.toISOString()).toBeLessThanOrEqual(15)

    await settings.waitForImportResult(second)
    await expect(settings.historyCell(settings.historyRow(third), '結果')).toHaveText('未処理')
    await settings.waitForImportResult(third)

    for (const name of [first, second, third]) {
      const result = settings.historyCell(settings.historyRow(name), '結果')
      await expect(result).toHaveText('フォーマットエラー')
      await expect(result.getByText('フォーマットエラー')).toHaveCSS('color', RED)
    }
    // ID は上書きしない場合も確かめる。行は見出しを除いて 1 から数え、見つけた誤りを 1 件 1 行で記録する
    expect(await errorMessage(settings, first)).toBe([
      '1行目: IDは数字で入力してください',
      '1行目: 画像ファイル(missing.png)が存在していません',
      '3行目: IDは数字で入力してください',
    ].join('\n'))
    expect(await errorMessage(settings, second)).toBe('zipファイルの解凍に失敗しました')
    expect(await errorMessage(settings, third)).toBe('zip内にエクセル/CSVファイルが複数含まれています')

    // 何も取り込まない（項目もカードも増えない）。オーナーのテーブルビューに失敗を表示する
    const screen = new ProjectScreen(ownerPage, project.id)
    await screen.openTableView()
    await expect(screen.failedAlert).toBeVisible()
    await expectHeaders(screen, ['並び順', 'ID', 'みだし', 'メモ'])
    await expectCards(screen, [{ order: '1', id: '1', values: ['元のカード', ''] }])
  })

  test('表に行が無い・見出しだけ・zip にエクセル/CSV が無い（__MACOSX の中と、拡張子が大文字のものは数えない）とフォーマットエラーにし、エクセルは最初のシートを取り込む', spec('features/import-export.md',
    'インポート > インポートできるのは、エクセル（xlsx）、CSV（UTF-8）、zip のファイルとする',
    'インポート > WHERE エクセル・CSV の場合、最初のシートの表を取り込む',
    'インポート > WHERE zip の場合 > エクセル・CSV のファイルは、名前が .xlsx・.csv（小文字）で終わるものを探す',
    'インポート > zip にエクセル・CSV が無い',
    'インポート > 表に行が無い',
    'インポート > 表に見出しの行しか無い',
  ), async ({ ownerPage, owner, project, tag }) => {
    test.setTimeout(8 * 60_000)
    const settings = new ProjectSettingsPage(ownerPage, project.id)
    await settings.open('インポート')

    const files: ImportFile[] = [
      { ...await fileOf('empty.xlsx', MIME.xlsx), name: `${tag}-1-empty.xlsx` },
      { ...await fileOf('header-only.csv', MIME.csv), name: `${tag}-2-header-only.csv` },
      // README.CSV と __MACOSX/._cards.csv と画像だけ
      { ...await fileOf('no-table.zip', MIME.zip), name: `${tag}-3-no-table.zip` },
      // 1 枚目: ID,みだし / 1,エクセルの行。2 枚目: ID,みだし,二枚目の項目 / 1,二枚目の行,x
      { ...await fileOf('cards.xlsx', MIME.xlsx), name: `${tag}-4-cards.xlsx` },
    ]
    for (const file of files) await uploadImport(owner, project.id, file)
    const [empty, headerOnly, noTable, xlsx] = files.map((f) => f.name)

    for (const name of [empty, headerOnly, noTable, xlsx]) await settings.waitForImportResult(name, IMPORT_TIMEOUT)

    await expect(settings.historyCell(settings.historyRow(empty), '結果')).toHaveText('フォーマットエラー')
    expect(await errorMessage(settings, empty)).toBe('エクセル/CSVファイルに行が存在していません')
    await expect(settings.historyCell(settings.historyRow(headerOnly), '結果')).toHaveText('フォーマットエラー')
    expect(await errorMessage(settings, headerOnly)).toBe('エクセル/CSVファイルにデータが存在していません')
    await expect(settings.historyCell(settings.historyRow(noTable), '結果')).toHaveText('フォーマットエラー')
    expect(await errorMessage(settings, noTable)).toBe('zip内にエクセル/CSVファイルが含まれていません')
    await expect(settings.historyCell(settings.historyRow(xlsx), '結果')).toHaveText('インポート済')

    const screen = new ProjectScreen(ownerPage, project.id)
    await screen.openTableView()
    await expectHeaders(screen, ['並び順', 'ID', 'みだし', 'メモ'])
    // ID は、ファイルの ID の列（1）の次から振る
    await expectCards(screen, [{ order: '1', id: '2', values: ['エクセルの行', ''] }])
  })

  test('【既知の問題】BOM の無い UTF-8 の CSV は日本語が文字化けして取り込まれ、0 バイトの CSV は「データが存在していません」になる（あるべき: UTF-8 として取り込む・「行が存在していません」とする）', withIssue(
    spec('features/import-export.md',
      'インポート > インポートできるのは、エクセル（xlsx）、CSV（UTF-8）、zip のファイルとする',
      'インポート > 表に行が無い',
    ),
    knownIssue('docs/ISSUES.md', 'BOM の無い UTF-8 の CSV は文字化けする'),
    knownIssue('features/import-export.md', '0 バイトの CSV は、「行が存在していません」ではなく「エクセル/CSVファイルにデータが存在していません」になる'),
  ), async ({ ownerPage, owner, project, tag }) => {
    test.setTimeout(8 * 60_000)
    const settings = new ProjectSettingsPage(ownerPage, project.id)
    await settings.open('インポート')

    // no-bom.csv: ID,みだし / ,文字化けの確認（BOM なし）
    const noBom = `${tag}-1-no-bom.csv`
    const empty = `${tag}-2-empty.csv`
    await uploadImport(owner, project.id, { ...await fileOf('no-bom.csv', MIME.csv), name: noBom })
    await uploadImport(owner, project.id, { ...await fileOf('empty.csv', MIME.csv), name: empty })
    for (const name of [noBom, empty]) await settings.waitForImportResult(name, IMPORT_TIMEOUT)

    await expect(settings.historyCell(settings.historyRow(noBom), '結果')).toHaveText('インポート済')
    await expect(settings.historyCell(settings.historyRow(empty), '結果')).toHaveText('フォーマットエラー')
    expect(await errorMessage(settings, empty)).toBe('エクセル/CSVファイルにデータが存在していません')

    // 「みだし」が別の名前（文字化け）になり、項目が増える。値も文字化けする
    const screen = new ProjectScreen(ownerPage, project.id)
    await screen.openTableView()
    await expect(screen.headerRow).not.toHaveText(/文字化け/)
    await expect(screen.values(screen.cardRows.first())).toHaveCount(3)
    await expect(screen.values(screen.cardRows.first()).nth(0)).toHaveValue('')
    await expect(screen.values(screen.cardRows.first()).nth(2)).not.toHaveValue('文字化けの確認')
    await expect(screen.values(screen.cardRows.first()).nth(2)).not.toHaveValue('')
  })

  test('【既知の問題】「画像ファイル」の列で空白が 2 つ続くとシステムエラー（赤）になり、それまでに取り込んだ項目・カード・値は残る（あるべき: 空白を区切りとして取り込む）', withIssue(
    spec('features/import-export.md',
      'インポート > IF 取り込みの途中で予期しないエラーが起きた場合',
      'インポート > WHERE zip の場合 > WHERE 「画像ファイル」の列がある場合 > ファイル名は、空白または改行で区切って複数書ける',
      'pages/project-settings.md > インポート > 取り込みの途中で予期しないエラーが起きた | システムエラー（赤）',
      'pages/project-settings.md > インポート > WHERE 結果がフォーマットエラー・システムエラーの場合',
    ),
    knownIssue('docs/ISSUES.md', '画像ファイルの列で空白が続くとシステムエラーになり、途中まで取り込まれる'),
  ), async ({ ownerPage, owner, project, tag }) => {
    const settings = new ProjectSettingsPage(ownerPage, project.id)
    await settings.open('インポート')

    // cards.csv: ID,みだし,途中の列,画像ファイル / ,一行目,値1,a.png / ,二行目,値2,"a.png  b.png"
    const name = `${tag}-double-space.zip`
    await uploadImport(owner, project.id, { ...await fileOf('double-space.zip', MIME.zip), name })
    await settings.waitForImportResult(name)

    const result = settings.historyCell(settings.historyRow(name), '結果')
    await expect(result).toHaveText('システムエラー')
    await expect(result.getByText('システムエラー')).toHaveCSS('color', RED)
    expect(await errorMessage(settings, name)).toMatch(/Error/)

    const screen = new ProjectScreen(ownerPage, project.id)
    await screen.openTableView()
    await expect(screen.failedAlert).toBeVisible()
    await expectHeaders(screen, ['並び順', 'ID', 'みだし', 'メモ', '途中の列'])
    await expectCards(screen, [
      { order: '1', id: '1', values: ['一行目', '', '値1'] },
      { order: '2', id: '2', values: ['二行目', '', '値2'] },
    ])
  })

  test('取り込んでいる間は結果を「インポート中」と表示し、終わってから「再読み込み」を押すとダイアログを閉じる', spec('pages/project-settings.md',
    'インポート > 取り込んでいる | インポート中',
    'features/import-export.md > インポート中の画面 > WHILE プロジェクトのインポートを待っている間 > 「再読み込み」ボタンで',
  ), async ({ ownerPage, owner, project, tag, pageAs }) => {
    const settings = new ProjectSettingsPage(ownerPage, project.id)
    await settings.open('インポート')

    const name = `${tag}-slow.zip`
    await uploadImport(owner, project.id, { name, mimeType: MIME.zip, buffer: await slowZip('\ufeffID,みだし\n,時間のかかるインポート\n') })
    const screen = new ProjectScreen(await pageAs(owner), project.id)
    await screen.openTableView()
    await expect(screen.importingDialog).toBeVisible()

    // 読み直しながら、結果の移り変わりを集める
    const seen: string[] = []
    await expect(async () => {
      await settings.reloadHistory()
      const text = (await settings.historyCell(settings.historyRow(name), '結果').innerText()).trim()
      if (seen.at(-1) !== text) seen.push(text)
      expect(text).not.toMatch(/未処理|インポート中/)
    }).toPass({ timeout: IMPORT_TIMEOUT, intervals: [300] })
    expect(seen).toEqual(expect.arrayContaining(['インポート中']))
    expect(seen.at(-1)).toBe('インポート済')

    // 終わった後に「再読み込み」を押すと、自動の確認（30 秒ごと）を待たずに閉じる
    await screen.reloadButton.click()
    await expect(screen.importingDialog).toBeHidden({ timeout: 5_000 })
    await expect(screen.values(screen.cardRows.first()).first()).toHaveValue('時間のかかるインポート')
  })
})
