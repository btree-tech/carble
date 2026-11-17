import { expect, test } from '../../fixtures'
import { CardViewPage, getCardByApi, listCardsByApi } from '../../pages/CardViewPage'
import { captureCardQrCode, ScanButton } from '../../pages/components/ScanButton'
import { open } from '../../support/navigation'
import { knownIssue, spec, withIssue } from '../../support/spec'

const SPEC = 'features/scan.md'

test('テーブルビューとカード入力ビューに「スキャン」を表示し、押すと画像を選ぶ画面を開く', spec(SPEC,
  '「スキャン」ボタンを表示する',
  'WHEN 「スキャン」を押すと、画像を選ぶ画面を開く',
), async ({ ownerPage, ownerApi, project }) => {
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

test('印刷したカードの QR コードを読み取ると、そのカードに画像を追加し、カード入力ビューに遷移して「スキャン完了」と表示する', spec(SPEC,
  'WHEN 画像を選ぶと、画像の中の QR コードを読み取る',
  'WHEN 画像を選ぶと、画像の中の QR コードを読み取る > WHILE 読み取りと画像の追加の処理中は',
  'WHEN 画像を選ぶと、画像の中の QR コードを読み取る > WHERE カード印刷ビューで印刷したカードの QR コード',
  'pages/print-view.md > プレビュー > 各カードの固定領域でない領域に',
), async ({ ownerPage, ownerApi, project }) => {
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

test('QR コードが写っていない画像では、末尾にその画像を持つ新しいカードを作り、そのカードに遷移して「新しいカードを追加しました」と表示する', spec(SPEC,
  'WHEN 画像を選ぶと、画像の中の QR コードを読み取る > WHERE QR コードが写っていない',
), async ({ ownerPage, ownerApi, project }) => {
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

test('QR コードのカードを開けない（削除した）ときは、新しいカードを作る', spec(SPEC,
  'WHEN 画像を選ぶと、画像の中の QR コードを読み取る > WHERE QR コードが写っていない',
), async ({ ownerPage, ownerApi, project }) => {
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

test('【既知の問題】検索結果に無いカードの QR コードを読み取ると、一覧の最後のカードに画像を追加する（あるべき: 読み取ったカードに追加する）', withIssue(
  spec(SPEC, 'WHEN 画像を選ぶと、画像の中の QR コードを読み取る > WHERE カード印刷ビューで印刷したカードの QR コード'),
  knownIssue('docs/ISSUES.md', '一覧に無いカードの QR コードをスキャンすると別のカードに画像を追加する'),
), async ({ ownerPage, ownerApi, project, tag }) => {
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

test('【既知の問題】別のプロジェクトのカードの QR コードを読み取ると、開いている一覧の最後のカードに画像を追加する（あるべき: 読み取ったカードに追加する）', withIssue(
  spec(SPEC, 'WHEN 画像を選ぶと、画像の中の QR コードを読み取る > WHERE カード印刷ビューで印刷したカードの QR コード'),
  knownIssue('docs/ISSUES.md', '一覧に無いカードの QR コードをスキャンすると別のカードに画像を追加する'),
), async ({ ownerPage, ownerApi, project, tag }) => {
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

test('【既知の問題】別のプロジェクトのカードの QR コードを読み取ると、開いている一覧の同じ ID のカードに画像を追加する（あるべき: 読み取ったカードに追加する）', withIssue(
  spec(SPEC, 'WHEN 画像を選ぶと、画像の中の QR コードを読み取る > WHERE カード印刷ビューで印刷したカードの QR コード'),
  knownIssue('docs/ISSUES.md', '一覧に無いカードの QR コードをスキャンすると別のカードに画像を追加する'),
), async ({ ownerPage, ownerApi, project, tag }) => {
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
