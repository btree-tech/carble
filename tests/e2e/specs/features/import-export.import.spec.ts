import { createDeflateRaw, crc32, deflateRawSync } from 'node:zlib'
import type { Page } from '@playwright/test'
import { expect, test } from '../../fixtures'
import { IMPORT_TIMEOUT } from '../../support/imports'
import { CardViewPage } from '../../pages/CardViewPage'
import { GridViewPage } from '../../pages/GridViewPage'
import {
  addImage,
  bomCsv,
  fileOf,
  MIME,
  ProjectScreen,
  ProjectSettingsPage,
  uploadImport,
  type ImportFile,
} from '../../pages/ProjectSettingsPage'
import { TableViewPage } from '../../pages/TableViewPage'
import { knownIssue } from '../../support/spec'

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
  test('CSV を上書きせずに取り込むと、すべての行を新しいカードとして末尾に追加し、ID を振り直す。待っている間はダイアログを表示し、終わると自動で閉じてオーナーに完了を表示する', {
    tag: [
      '@TC-FT-IMPEXP-IMP1',
      '@TC-FT-IMPEXP-IMP5',
      '@TC-FT-IMPEXP-IMP6',
      '@TC-FT-IMPEXP-IMP7',
      '@TC-FT-IMPEXP-IMP8',
      '@TC-FT-IMPEXP-IMP9',
      '@TC-FT-IMPEXP-IMP10',
      '@TC-FT-IMPEXP-IMP11',
      '@TC-FT-IMPEXP-IMP19',
      '@TC-FT-IMPEXP-IMP25',
      '@TC-FT-IMPEXP-IMP20',
      '@TC-FT-IMPEXP-IMP24',
      '@TC-FT-IMPEXP-WAIT1',
      '@TC-FT-IMPEXP-WAIT4',
      '@TC-FT-IMPEXP-WAIT5',
      '@TC-PG-PSET-IMP9',
      '@TC-PG-PSET-IMP10',
      '@TC-PG-PSET-IMP11',
      '@TC-PG-PSET-IMP23',
    ],
  }, async ({ ownerPage, ownerApi, project, newAccount, apiAs, pageAs }) => {
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

  test('zip（エクセル・画像）を上書きして取り込むと、同じ ID のカードの値と画像を置き換え、無い ID・空の ID は新しいカードにする', {
    tag: [
      '@TC-FT-IMPEXP-IMP12',
      '@TC-FT-IMPEXP-IMP13',
      '@TC-FT-IMPEXP-IMP14',
      '@TC-FT-IMPEXP-IMP15',
      '@TC-FT-IMPEXP-IMP16',
      '@TC-FT-IMPEXP-IMP17',
      '@TC-FT-IMPEXP-IMP26',
      '@TC-FT-IMPEXP-IMP27',
      '@TC-FT-IMPEXP-IMP28',
      '@TC-FT-IMPEXP-IMP20',
      '@TC-PG-PSET-IMP11',
    ],
  }, async ({ ownerPage, owner, ownerApi, project }) => {
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

  test('【実装との乖離】オーナー以外（編集者）も URL を直接開いて取り込める。「画像ファイル」の列が無い zip は、上書きしても画像を変えない（あるべき: オーナーだけがインポートできる）', {
    annotation: [
      knownIssue('pages/project-settings.md', 'オーナー以外にはタブを表示しないが、URL を直接開くと「インポート」「ユーザー管理」「プロジェクト削除」の画面を表示する。（略）インポートはサーバー側のオーナー判定が効いておらず、取り込めてしまう'),
    ],
  }, async ({ owner, ownerApi, project, newAccount, apiAs, pageAs }) => {
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

  test('ファイルに誤りがあると、何も取り込まずフォーマットエラー（赤）とし、行を開くと記録した内容を表示する。インポートは毎分 0 秒に、アップロードの古い順に 1 件ずつ取り込む', {
    tag: [
      '@TC-FT-IMPEXP-IMP2',
      '@TC-FT-IMPEXP-IMP3',
      '@TC-FT-IMPEXP-IMP21',
      '@TC-FT-IMPEXP-IMP29',
      '@TC-FT-IMPEXP-IMP30',
      '@TC-FT-IMPEXP-IMP31',
      '@TC-FT-IMPEXP-IMP33',
      '@TC-FT-IMPEXP-IMP22',
      '@TC-FT-IMPEXP-IMP24',
      '@TC-FT-NFR-IMP1',
      '@TC-PG-PSET-IMP21',
      '@TC-PG-PSET-IMP24',
      '@TC-PG-PSET-IMP20',
    ],
  }, async ({ ownerPage, owner, ownerApi, project, tag }) => {
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

  test('表に行が無い・見出しだけ・zip にエクセル/CSV が無い（__MACOSX の中と、拡張子が大文字のものは数えない）とフォーマットエラーにし、エクセルは最初のシートを取り込む', {
    tag: [
      '@TC-FT-IMPEXP-IMP1',
      '@TC-FT-IMPEXP-IMP4',
      '@TC-FT-IMPEXP-IMP13',
      '@TC-FT-IMPEXP-IMP32',
      '@TC-FT-IMPEXP-IMP34',
      '@TC-FT-IMPEXP-IMP35',
    ],
  }, async ({ ownerPage, owner, project, tag }) => {
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

  test('【既知の問題】BOM の無い UTF-8 の CSV は日本語が文字化けして取り込まれ、0 バイトの CSV は「データが存在していません」になる（あるべき: UTF-8 として取り込む・「行が存在していません」とする）', {
    annotation: [
      knownIssue('docs/ISSUES.md', 'BOM の無い UTF-8 の CSV は文字化けする'),
      knownIssue('features/import-export.md', '0 バイトの CSV は、「行が存在していません」ではなく「エクセル/CSVファイルにデータが存在していません」になる'),
    ],
  }, async ({ ownerPage, owner, project, tag }) => {
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

  test('【既知の問題】「画像ファイル」の列で空白が 2 つ続くとシステムエラー（赤）になり、それまでに取り込んだ項目・カード・値は残る（あるべき: 空白を区切りとして取り込む）', { annotation: [knownIssue('docs/ISSUES.md', '画像ファイルの列で空白が続くとシステムエラーになり、途中まで取り込まれる')] }, async ({ ownerPage, owner, project, tag }) => {
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

  test('取り込んでいる間は結果を「インポート中」と表示し、終わってから「再読み込み」を押すとダイアログを閉じる', { tag: ['@TC-PG-PSET-IMP22', '@TC-FT-IMPEXP-WAIT3'] }, async ({ ownerPage, owner, project, tag, pageAs }) => {
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

test.describe('ユーザーストーリー', () => {
  test('研究者が、エクスポートと同じ形式（ID・項目・「画像ファイル」の列のエクセルと画像のファイル）の zip を取り込み、表計算ソフトのデータと画像をまとめてプロジェクトに移す', { tag: ['@story', '@TC-FT-IMPEXP-US1'] }, async ({ ownerPage, project }) => {
    const settings = new ProjectSettingsPage(ownerPage, project.id)
    await settings.open('インポート')

    // エクスポートの zip と同じく、エクセル 1 つ（ID・項目・画像ファイルの列）と画像のファイルを入れたもの。
    // エクスポートは今は失敗する（docs/ISSUES.md「エクスポートが失敗する」）ので、同じ形式のファイルを使う
    // data.xlsx: ID,みだし,メモ,画像ファイル
    //   1,一改,(空),"img/wide.png⏎small.jpeg" / 2,二改,メモ二改,(空) / (空),新規,(空),"img/wide.png small.jpeg" / 50,五十,(空),(空)
    await settings.chooseFile(await fileOf('update.zip', MIME.zip))
    await settings.startImport()

    const screen = new ProjectScreen(ownerPage, project.id)
    await expect(ownerPage).toHaveURL(`/projects/${project.id}`)
    await expect(screen.importingDialog).toBeVisible()
    await screen.waitForImportDone()

    await expect(screen.importedAlert).toBeVisible()
    await expectHeaders(screen, ['並び順', 'ID', 'みだし', 'メモ'])
    // 上書きしないので、ID はファイルの ID の列のいちばん大きい数字（50）の次から振り直し、ファイルの行の順に並べる
    await expectCards(screen, [
      { order: '1', id: '51', values: ['一改', ''] },
      { order: '2', id: '52', values: ['二改', 'メモ二改'] },
      { order: '3', id: '53', values: ['新規', ''] },
      { order: '4', id: '54', values: ['五十', ''] },
    ])

    // 画像も、各行のカードに取り込まれている（改行区切り・空白区切り、フォルダの中の画像を含む）
    const expected: [number, [number, number][]][] = [
      [51, [[640, 320], [100, 50]]],
      [52, []],
      [53, [[640, 320], [100, 50]]],
      [54, []],
    ]
    for (const [cardId, sizes] of expected) {
      await screen.openCard(cardId)
      await expect(ownerPage.getByRole('button', { name: '画像を追加' })).toBeVisible()
      await expect(ownerPage.getByRole('img'), `カード ${cardId} の画像`).toHaveCount(sizes.length)
      expect(await imageSizes(ownerPage), `カード ${cardId} の画像`).toEqual(sizes)
    }
  })

  test('研究者が、大きなファイル（展開すると 100MB を超える zip に 1,000 行の表）を取り込むと、アップロードはすぐに終わってテーブルビューに移り、取り込みが後から終わってすべての行がカードになる', { tag: ['@story', '@TC-FT-IMPEXP-US2'] }, async ({ ownerPage, project, tag }) => {
    const rows = Array.from({ length: 1000 }, (_, i) => `,資料${i + 1},メモ${i + 1}`)
    const name = `${tag}-large.zip`
    // 展開に時間のかかる大きさにする。1GB にすると、x64 の模倣で動く Mac では取り込みが待つ時間の上限を超える
    const buffer = await slowZip(`\ufeffID,みだし,メモ\n${rows.join('\n')}\n`, 100 * 1024 * 1024)

    const settings = new ProjectSettingsPage(ownerPage, project.id)
    await settings.open('インポート')
    await settings.chooseFile({ name, mimeType: MIME.zip, buffer })
    const uploaded = ownerPage.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith(`/api/projects/${project.id}/imports`))
    await settings.startImport()

    // アップロードは取り込みを待たずに終わり、テーブルビューで取り込みを待つ
    expect((await uploaded).ok()).toBe(true)
    const screen = new ProjectScreen(ownerPage, project.id)
    await expect(ownerPage).toHaveURL(`/projects/${project.id}`)
    await expect(screen.importingDialog).toBeVisible()
    await screen.waitForImportDone()

    await expect(screen.importedAlert).toBeVisible()
    await expect(new TableViewPage(ownerPage).countText).toHaveText('全 1000 件')
    await expect(screen.cardRows).toHaveCount(1000)
    // 最初と最後の行（ID はファイルの行の順に 1 から振る）
    for (const [row, n] of [[screen.cardRows.first(), 1], [screen.cardRows.last(), 1000]] as const) {
      await expect(screen.orderCell(row)).toHaveText(String(n))
      await expect(screen.idCell(row)).toHaveText(String(n))
      await expect(screen.values(row).nth(0)).toHaveValue(`資料${n}`)
      await expect(screen.values(row).nth(1)).toHaveValue(`メモ${n}`)
    }
  })

  test('研究者が、インポートを始めた後、「再読み込み」も画面の読み込み直しもせずに待つと、ダイアログが自動で閉じ、完了の表示と取り込んだカードで終わったことを知る', { tag: ['@story', '@TC-FT-IMPEXP-US3'] }, async ({ ownerPage, project, tag }) => {
    const settings = new ProjectSettingsPage(ownerPage, project.id)
    await settings.open('インポート')
    const file = bomCsv(`${tag}-wait.csv`, [
      ['ID', 'みだし'],
      ['', '取り込みを待つカード1'],
      ['', '取り込みを待つカード2'],
    ])
    await settings.chooseFile(file)
    await settings.startImport()

    const screen = new ProjectScreen(ownerPage, project.id)
    await expect(ownerPage).toHaveURL(`/projects/${project.id}`)
    await expect(screen.importingDialog).toBeVisible()
    await expect(screen.table).toHaveCount(0)

    // ここからは何も操作せずに待つ。画面を読み込み直していないことを、読み込んだ回数で確かめる
    let loads = 0
    ownerPage.on('load', () => { loads++ })
    await expect(screen.importingDialog).toBeHidden({ timeout: IMPORT_TIMEOUT })

    await expect(screen.importedAlert).toBeVisible()
    await expectCards(screen, [
      { order: '1', id: '1', values: ['取り込みを待つカード1', ''] },
      { order: '2', id: '2', values: ['取り込みを待つカード2', ''] },
    ])
    expect(loads, '画面を読み込み直した回数').toBe(0)

    // 完了の表示の「詳細」から、インポート履歴で結果を確かめる
    await ownerPage.getByRole('link', { name: '詳細' }).click()
    await expect(ownerPage).toHaveURL(`/projects/${project.id}/settings/import`)
    await expect(settings.historyCell(settings.historyRow(file.name), '結果')).toHaveText('インポート済')
  })

  test('オーナーが、上書きを選ばずに、既存のカードと同じ ID の行を含むファイルを取り込むと、既存のカードの内容は変わらず、ファイルの行は新しいカードとして加わる', { tag: ['@story', '@TC-FT-IMPEXP-US4'] }, async ({ ownerPage, ownerApi, project, tag }) => {
    await ownerApi.addCard(project.id, { みだし: '手で書いた記録', メモ: '大事なメモ' })
    await ownerApi.addCard(project.id, { みだし: '二枚目の記録', メモ: '二枚目のメモ' })

    const settings = new ProjectSettingsPage(ownerPage, project.id)
    await settings.open('インポート')
    const file = bomCsv(`${tag}-same-id.csv`, [
      ['ID', 'みだし', 'メモ'],
      ['1', '表計算の値1', ''],
      ['2', '表計算の値2', ''],
    ])
    await settings.chooseFile(file)
    // 上書きは、明示的に選ばない限りしない
    await expect(settings.updateCheckbox).not.toBeChecked()
    await settings.startImport()

    const screen = new ProjectScreen(ownerPage, project.id)
    await expect(screen.importingDialog).toBeVisible()
    await screen.waitForImportDone()

    await expect(screen.importedAlert).toBeVisible()
    await expectCards(screen, [
      { order: '1', id: '1', values: ['手で書いた記録', '大事なメモ'] },
      { order: '2', id: '2', values: ['二枚目の記録', '二枚目のメモ'] },
      // ファイルの行は、プロジェクトとファイルの ID のいちばん大きい数字（2）の次の ID で末尾に加わる
      { order: '3', id: '3', values: ['表計算の値1', ''] },
      { order: '4', id: '4', values: ['表計算の値2', ''] },
    ])

    // カード入力ビューで開いても、元の内容が残っている
    const cardView = new CardViewPage(ownerPage)
    await cardView.open(project.id, 1)
    await expect(cardView.field('みだし')).toHaveValue('手で書いた記録')
    await expect(cardView.field('メモ')).toHaveValue('大事なメモ')
  })

  test('研究者が、資料の順に行を並べたファイル（ID は順不同）を取り込むと、ID の順ではなくファイルの行の順に並び順が振られ、テーブルビューとグリッドビューで資料の順に並ぶ', { tag: ['@story', '@TC-FT-IMPEXP-US6'] }, async ({ ownerPage, ownerApi, project, tag }) => {
    await ownerApi.addCard(project.id, { みだし: '既存の一' })
    await ownerApi.addCard(project.id, { みだし: '既存の二' })

    // ID を指定して取り込む（上書きを選ぶと、無い ID はその ID で新しいカードを作る）。ID の順と資料の順が違う
    const settings = new ProjectSettingsPage(ownerPage, project.id)
    await settings.open('インポート')
    await settings.chooseFile(bomCsv(`${tag}-order.csv`, [
      ['ID', 'みだし'],
      ['30', '資料の1枚目'],
      ['10', '資料の2枚目'],
      ['20', '資料の3枚目'],
    ]))
    await settings.checkUpdate()
    await settings.startImport()

    const screen = new ProjectScreen(ownerPage, project.id)
    await expect(screen.importingDialog).toBeVisible()
    await screen.waitForImportDone()

    await expect(screen.importedAlert).toBeVisible()
    // テーブルビューは並び順の昇順。既存のカードの後に、ファイルの行の順に並ぶ
    await expectCards(screen, [
      { order: '1', id: '1', values: ['既存の一', ''] },
      { order: '2', id: '2', values: ['既存の二', ''] },
      { order: '3', id: '30', values: ['資料の1枚目', ''] },
      { order: '4', id: '10', values: ['資料の2枚目', ''] },
      { order: '5', id: '20', values: ['資料の3枚目', ''] },
    ])

    // グリッドビューでも同じ順に並ぶ（タイルには「ID: N」を表示する）
    const grid = new GridViewPage(ownerPage)
    await grid.open(project.id)
    const ids = [1, 2, 30, 10, 20]
    await expect(grid.tiles).toHaveCount(ids.length)
    for (const [i, id] of ids.entries()) {
      await expect(grid.tile(i), `${i + 1} 枚目のタイル`).toContainText(new RegExp(`ID: ${id}(?!\\d)`))
    }
  })
})
