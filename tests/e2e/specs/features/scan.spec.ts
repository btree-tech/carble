import { expect, test } from '../../fixtures'
import { CardViewPage, getCardByApi, listCardsByApi } from '../../pages/CardViewPage'
import { captureCardQrCode, ScanButton } from '../../pages/components/ScanButton'
import { PrintViewPage } from '../../pages/PrintViewPage'
import { TableViewPage } from '../../pages/TableViewPage'
import { open } from '../../support/navigation'
import { knownIssue } from '../../support/spec'

const SPEC = 'features/scan.md'

test('テーブルビューとカード入力ビューに「スキャン」を表示し、押すと画像を選ぶ画面を開く', { tag: ['@TC-FT-SCAN-GEN1', '@TC-FT-SCAN-GEN3'] }, async ({ ownerPage, ownerApi, project }) => {
  const card = await ownerApi.addCard(project.id)
  const scan = new ScanButton(ownerPage)

  await open(ownerPage, `/projects/${project.id}`)
  await expect(scan.button).toBeVisible()
  const chooser = await scan.openChooser()
  expect(chooser.isMultiple()).toBe(false)
  expect(await chooser.element().getAttribute('accept')).toBe('image/*')

  await new CardViewPage(ownerPage).open(project.id, card.id)
  await expect(scan.button).toBeVisible()
  await scan.openChooser()
})

test('印刷したカードの QR コードを読み取ると、そのカードに画像を追加し、カード入力ビューに遷移して「スキャン完了」と表示する', { tag: ['@TC-FT-SCAN-GEN5', '@TC-FT-SCAN-GEN6', '@TC-FT-SCAN-GEN7', '@TC-PG-PRINT-PREV6'] }, async ({ ownerPage, ownerApi, project }) => {
  await ownerApi.addCard(project.id)
  const target = await ownerApi.addCard(project.id, { みだし: 'QR のカード' })
  await ownerApi.addCard(project.id)
  const qr = await captureCardQrCode(ownerPage, project.id, target.id)
  await open(ownerPage, `/projects/${project.id}`)
  const scan = new ScanButton(ownerPage)

  await scan.scan(qr)

  await expect(scan.button).toBeDisabled()
  await expect(ownerPage).toHaveURL(`/projects/${project.id}/cards/${target.id}`)
  await expect(scan.toast('スキャン完了')).toBeVisible()
  await expect(scan.toast(`ID: ${target.id}のカードに画像を追加しました`)).toBeVisible()
  await expect(scan.button).toBeEnabled()
  const view = new CardViewPage(ownerPage)
  await expect(view.field('みだし')).toHaveValue('QR のカード')
  await expect(view.images).toHaveCount(1)
  expect((await getCardByApi(ownerPage, project.id, target.id)).images).toHaveLength(1)
  expect(await listCardsByApi(ownerPage, project.id)).toHaveLength(3)
})

test('QR コードが写っていない画像では、末尾にその画像を持つ新しいカードを作り、そのカードに遷移して「新しいカードを追加しました」と表示する', { tag: ['@TC-FT-SCAN-GEN8'] }, async ({ ownerPage, ownerApi, project }) => {
  const card = await ownerApi.addCard(project.id)
  const view = new CardViewPage(ownerPage)
  await view.open(project.id, card.id)
  const scan = new ScanButton(ownerPage)

  await scan.scan('green.png')

  await expect(scan.toast('スキャン完了')).toBeVisible()
  await expect(scan.toast('新しいカードを追加しました')).toBeVisible()
  const cards = await listCardsByApi(ownerPage, project.id)
  expect(cards).toHaveLength(2)
  const added = cards[1]
  expect(added.order).toBe(2)
  expect(added.images).toHaveLength(1)
  await expect(ownerPage).toHaveURL(`/projects/${project.id}/cards/${added.id}`)
  await expect(view.idValue).toHaveText(`ID${added.id}`)
  await expect(view.images).toHaveCount(1)
})

test('QR コードのカードを開けない（削除した）ときは、新しいカードを作る', { tag: ['@TC-FT-SCAN-GEN8'] }, async ({ ownerPage, ownerApi, project }) => {
  const kept = await ownerApi.addCard(project.id)
  const removed = await ownerApi.addCard(project.id)
  const qr = await captureCardQrCode(ownerPage, project.id, removed.id)
  await ownerApi.call('delete', `/api/projects/${project.id}/cards/${removed.id}`)
  await open(ownerPage, `/projects/${project.id}`)
  const scan = new ScanButton(ownerPage)

  await scan.scan(qr)

  await expect(scan.toast('新しいカードを追加しました')).toBeVisible()
  const cards = await listCardsByApi(ownerPage, project.id)
  expect(cards.map((c) => c.id)).toEqual([kept.id, cards[1].id])
  expect(cards[1].images).toHaveLength(1)
  await expect(ownerPage).toHaveURL(`/projects/${project.id}/cards/${cards[1].id}`)
})

test('【既知の問題】検索結果に無いカードの QR コードを読み取ると、一覧の最後のカードに画像を追加する（あるべき: 読み取ったカードに追加する）', { annotation: [knownIssue('docs/ISSUES.md', '一覧に無いカードの QR コードをスキャンすると別のカードに画像を追加する')] }, async ({ ownerPage, ownerApi, project, tag }) => {
  const listed = await ownerApi.addCard(project.id, { みだし: `当たる${tag}` })
  const target = await ownerApi.addCard(project.id, { みだし: '当たらない' })
  const qr = await captureCardQrCode(ownerPage, project.id, target.id)
  await open(ownerPage, `/projects/${project.id}?q=当たる${tag}`)
  const scan = new ScanButton(ownerPage)
  const posts: string[] = []
  ownerPage.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/images')) posts.push(new URL(request.url()).pathname)
  })

  await scan.scan(qr)

  await expect(ownerPage).toHaveURL(`/projects/${project.id}/cards/${target.id}`)
  await expect(scan.toast(`ID: ${target.id}のカードに画像を追加しました`)).toBeVisible()
  await expect.poll(async () => (await getCardByApi(ownerPage, project.id, listed.id)).images.length).toBe(1)
  expect(posts[0]).toBe(`/api/projects/${project.id}/cards/${listed.id}/images`)
  // 遷移した後に、読み取ったカードにも同じ画像を追加する要求が出ることがある（毎回ではないため、ここでは確かめない）
  for (const path of posts.slice(1)) expect(path).toBe(`/api/projects/${project.id}/cards/${target.id}/images`)
})

test('【既知の問題】別のプロジェクトのカードの QR コードを読み取ると、開いている一覧の最後のカードに画像を追加する（あるべき: 読み取ったカードに追加する）', { annotation: [knownIssue('docs/ISSUES.md', '一覧に無いカードの QR コードをスキャンすると別のカードに画像を追加する')] }, async ({ ownerPage, ownerApi, project, tag }) => {
  const other = await ownerApi.createProject(`別のプロジェクト${tag}`)
  // カードの ID はプロジェクトごとに 1 から振るので、開いている一覧に同じ ID のカードが無いようにする
  for (let i = 0; i < 2; i++) await ownerApi.addCard(other.id)
  const target = await ownerApi.addCard(other.id)
  await ownerApi.addCard(project.id)
  const last = await ownerApi.addCard(project.id)
  expect(target.id).toBeGreaterThan(last.id)
  const qr = await captureCardQrCode(ownerPage, other.id, target.id)
  await open(ownerPage, `/projects/${project.id}`)
  const scan = new ScanButton(ownerPage)

  await scan.scan(qr)

  await expect(ownerPage).toHaveURL(`/projects/${other.id}/cards/${target.id}`)
  await expect(scan.toast(`ID: ${target.id}のカードに画像を追加しました`)).toBeVisible()
  await expect.poll(async () => (await getCardByApi(ownerPage, project.id, last.id)).images.length).toBe(1)
  expect((await getCardByApi(ownerPage, other.id, target.id)).images).toHaveLength(0)
})

test('【既知の問題】別のプロジェクトのカードの QR コードを読み取ると、開いている一覧の同じ ID のカードに画像を追加する（あるべき: 読み取ったカードに追加する）', { annotation: [knownIssue('docs/ISSUES.md', '一覧に無いカードの QR コードをスキャンすると別のカードに画像を追加する')] }, async ({ ownerPage, ownerApi, project, tag }) => {
  const other = await ownerApi.createProject(`別のプロジェクト${tag}`)
  const target = await ownerApi.addCard(other.id)
  const sameId = await ownerApi.addCard(project.id)
  const last = await ownerApi.addCard(project.id)
  expect(sameId.id).toBe(target.id)
  const qr = await captureCardQrCode(ownerPage, other.id, target.id)
  await open(ownerPage, `/projects/${project.id}`)
  const scan = new ScanButton(ownerPage)

  await scan.scan(qr)

  await expect(ownerPage).toHaveURL(`/projects/${other.id}/cards/${target.id}`)
  await expect(scan.toast(`ID: ${target.id}のカードに画像を追加しました`)).toBeVisible()
  await expect.poll(async () => (await getCardByApi(ownerPage, project.id, sameId.id)).images.length).toBe(1)
  expect((await getCardByApi(ownerPage, project.id, last.id)).images).toHaveLength(0)
  expect((await getCardByApi(ownerPage, other.id, target.id)).images).toHaveLength(0)
})

test.describe('ユーザーストーリー', () => {
  test('研究者がカードを印刷し、印刷したカードと資料を一緒に撮った写真をスキャンすると、写真がそのカードに添えられ、続けて撮った写真も同じカードに添えられる', { tag: ['@story', '@TC-FT-SCAN-US1'] }, async ({ ownerPage, ownerApi, project }) => {
    const before = await ownerApi.addCard(project.id, { みだし: '別の資料' })
    const target = await ownerApi.addCard(project.id, { みだし: '土器片' })
    const after = await ownerApi.addCard(project.id, { みだし: 'もう一つの資料' })
    const view = new CardViewPage(ownerPage)
    const print = new PrintViewPage(ownerPage)
    const scan = new ScanButton(ownerPage)

    // カード入力ビューから、そのカードを印刷する
    await view.open(project.id, target.id)
    await view.printViewLink.click()
    await expect(print.cards).toHaveCount(1)
    await expect(print.card()).toContainText('土器片')

    // 印刷したカードを資料と一緒に 2 回撮影する（印刷する QR コードと、資料の代わりの色の四角を並べた画像）
    const firstPhoto = await print.photoOfCard(print.card(), '#a16207')
    const secondPhoto = await print.photoOfCard(print.card(), '#166534')

    // テーブルビューで 1 枚目の写真をスキャンすると、そのカードに添えられ、そのカードを開く
    await new TableViewPage(ownerPage).open(project.id)
    await scan.scan(firstPhoto)

    await expect(ownerPage).toHaveURL(`/projects/${project.id}/cards/${target.id}`)
    await expect(scan.toast('スキャン完了')).toBeVisible()
    await expect(scan.toast(`ID: ${target.id}のカードに画像を追加しました`)).toBeVisible()
    await expect(view.field('みだし')).toHaveValue('土器片')
    await expect(view.images).toHaveCount(1)
    await expect(scan.button).toBeEnabled()

    // 続けて 2 枚目の写真をスキャンすると、同じカードに添えられる
    await scan.scan(secondPhoto)

    await expect(view.images).toHaveCount(2)
    await expect(ownerPage).toHaveURL(`/projects/${project.id}/cards/${target.id}`)
    expect((await getCardByApi(ownerPage, project.id, target.id)).images).toHaveLength(2)
    const cards = await listCardsByApi(ownerPage, project.id)
    expect(cards.map((c) => [c.id, c.images.length])).toEqual([[before.id, 0], [target.id, 2], [after.id, 0]])
  })

  test('研究者が資料を撮った写真をスキャンすると、その写真を持つ新しいカードができて記録を書き始められ、続けて撮った資料も新しいカードになる', { tag: ['@story', '@TC-FT-SCAN-US2'] }, async ({ ownerPage, ownerApi, project }) => {
    const existing = await ownerApi.addCard(project.id, { みだし: '既にある記録' })
    const table = new TableViewPage(ownerPage)
    const view = new CardViewPage(ownerPage)
    const scan = new ScanButton(ownerPage)
    const midashi = (await ownerApi.fields(project.id)).find((f) => f.name === 'みだし')!.id
    const midashiOf = async (cardId: number) => (await getCardByApi(ownerPage, project.id, cardId)).contents.find((c) => c.fieldId === midashi)?.body

    // テーブルビューで資料の写真をスキャンすると、新しいカードができてそのカードを開く
    await table.open(project.id)
    await scan.scan('green.png')

    await expect(scan.toast('スキャン完了')).toBeVisible()
    await expect(scan.toast('新しいカードを追加しました')).toBeVisible()
    await expect.poll(async () => (await listCardsByApi(ownerPage, project.id)).length).toBe(2)
    const first = (await listCardsByApi(ownerPage, project.id))[1]
    await expect(ownerPage).toHaveURL(`/projects/${project.id}/cards/${first.id}`)
    await expect(view.idValue).toHaveText(`ID${first.id}`)
    await expect(view.images).toHaveCount(1)

    // 写真を見ながら記録を書き始める
    await view.field('みだし').fill('写真から始めた記録')
    await expect.poll(() => midashiOf(first.id)).toBe('写真から始めた記録')
    await expect(scan.button).toBeEnabled()

    // 続けて別の資料を撮影してスキャンすると、もう 1 枚の新しいカードができる
    await scan.scan('blue.png')

    await expect.poll(async () => (await listCardsByApi(ownerPage, project.id)).length).toBe(3)
    const second = (await listCardsByApi(ownerPage, project.id))[2]
    await expect(ownerPage).toHaveURL(`/projects/${project.id}/cards/${second.id}`)
    await expect(view.idValue).toHaveText(`ID${second.id}`)
    await expect(view.field('みだし')).toHaveValue('')
    await expect(view.images).toHaveCount(1)
    await view.field('みだし').fill('つぎの資料')
    await expect.poll(() => midashiOf(second.id)).toBe('つぎの資料')

    // テーブルビューで、写真から始めた記録が末尾に並んでいる
    await view.tableViewLink.click()
    await expect(table.rows).toHaveCount(3)
    await expect(table.idCells).toHaveText([String(existing.id), String(first.id), String(second.id)])
    await expect(await table.cellInput(first.id, 'みだし')).toHaveValue('写真から始めた記録')
    await expect(await table.cellInput(second.id, 'みだし')).toHaveValue('つぎの資料')
    const cards = await listCardsByApi(ownerPage, project.id)
    expect(cards.map((c) => c.images.length)).toEqual([0, 1, 1])
  })
})
