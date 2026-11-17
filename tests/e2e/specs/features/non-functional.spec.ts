import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '../../fixtures'
import { addImage, fileOf, MIME, ProjectScreen } from '../../pages/ProjectSettingsPage'
import { open } from '../../support/navigation'
import { spec } from '../../support/spec'

test('Docker で起動したサーバー（起動時にマイグレーションした、まっさらな DB）で、画面を開いてデータを読み書きできる', spec('features/non-functional.md',
  '動作環境 > サーバーは Docker で動作する',
  'サーバーの設定 > WHEN サーバーを起動すると（Docker の場合）、DB のマイグレーションを実行してからアプリを起動する',
), async ({ ownerPage, ownerApi, project }) => {
  // E2E の app は本番と同じ Dockerfile のイメージで、毎回まっさらなボリュームから起動する（docker-compose.e2e.yml）
  await ownerApi.addCard(project.id, { みだし: '起動後に書いた値' })

  await open(ownerPage, '/')
  await expect(ownerPage.getByRole('cell', { name: project.name })).toBeVisible()
  const screen = new ProjectScreen(ownerPage, project.id)
  await screen.openTableView()
  await expect(screen.values(screen.cardRows.first()).first()).toHaveValue('起動後に書いた値')
})

test('Basic 認証の設定が無い（既定値）と、Basic 認証をかけずに画面と API を開ける', spec('features/non-functional.md',
  'Basic 認証 > 既定値は設定なし（Basic 認証をかけない）',
), async ({ pageAs }) => {
  // E2E の app は NUXT_BASIC_AUTH_USER・NUXT_BASIC_AUTH_PASSWORD を設定していない
  const page = await pageAs('guest')
  const response = await page.goto('/login')

  expect(response?.status()).toBe(200)
  expect(response?.headers()['www-authenticate']).toBeUndefined()
  await expect(page.getByRole('button', { name: 'Googleでログイン' })).toBeVisible()
  const health = await page.request.get('/api/health')
  expect(health.status()).toBe(200)
  expect(health.headers()['www-authenticate']).toBeUndefined()
})

test('入力した値は、入力が止まってから 1 秒後に保存する', spec('features/non-functional.md',
  '自動保存 > 入力した値は、入力が止まってから 1 秒後に保存する',
), async ({ ownerPage, ownerApi, project }) => {
  const card = await ownerApi.addCard(project.id)
  const screen = new ProjectScreen(ownerPage, project.id)
  await screen.openCard(card.id)
  const saves: number[] = []
  ownerPage.on('request', (request) => {
    if (request.method() === 'PUT' && request.url().includes(`/api/projects/${project.id}/cards/${card.id}/fields/`)) saves.push(Date.now())
  })

  // 1 秒より短い間隔で 1 文字ずつ打ち、打った時刻を記録する
  const textbox = ownerPage.getByRole('textbox', { name: 'みだし' })
  await textbox.click()
  const keys: number[] = []
  for (const key of 'autosave') {
    await textbox.press(key)
    keys.push(Date.now())
    await expect.poll(() => Date.now() - keys.at(-1)!, { intervals: [50] }).toBeGreaterThanOrEqual(300)
  }
  const typingEnded = keys.at(-1)!

  await expect.poll(() => saves.filter((t) => t > typingEnded).length, { timeout: 5_000 }).toBeGreaterThan(0)
  // どの保存も、その前の最後の入力から 1 秒（タイマーの誤差を見込む）経ってから送る
  // （テストのブラウザが詰まって入力の間が 1 秒空いた場合は、途中でも保存してよい）
  // カード入力ビューの裏に隠れたテーブルビューも同じ値を見張っているため、同じ保存が 2 回送られることがある
  for (const savedAt of saves) {
    const lastKey = keys.filter((t) => t <= savedAt).at(-1)!
    expect(savedAt - lastKey).toBeGreaterThanOrEqual(900)
  }
  // 入力が止まってからの保存は、1 秒あまりで送る
  for (const savedAt of saves.filter((t) => t > typingEnded)) expect(savedAt - typingEnded).toBeLessThan(2_500)

  await screen.openCard(card.id)
  await expect(ownerPage.getByRole('textbox', { name: 'みだし' })).toHaveValue('autosave')
})

test('画像は、元の画像とは別に、長辺 640px 以内に縮小した WebP を初めて表示するときに作って表示する。元より大きくはしない', spec('features/non-functional.md',
  '画像の表示 > 画像は、元の画像とは別に、長辺 640px 以内に縮小した画像（WebP）を',
), async ({ ownerPage, owner, ownerApi, project }) => {
  const card = await ownerApi.addCard(project.id)
  const wide = await fileOf('wide.png', MIME.png) // 1000×500
  const small = await fileOf('small.png', MIME.png) // 100×50
  const images = [await addImage(owner, project.id, card.id, wide), await addImage(owner, project.id, card.id, small)]
  // 縮小した画像を作る時期は画面に出ないので、app と共有のボリュームを見る（読むだけ）
  const thumbPath = (filename: string) => join(process.env.UPLOADS_PATH!, 'public/thumbs', `${filename}.webp`)
  for (const image of images) expect(existsSync(thumbPath(image.filename))).toBe(false)

  const screen = new ProjectScreen(ownerPage, project.id)
  await screen.openCard(card.id)

  const shown = ownerPage.getByRole('img')
  await expect(shown).toHaveCount(2)
  const expected: [number, number][] = [[640, 320], [100, 50]]
  for (const [i, size] of expected.entries()) {
    await expect.poll(() => shown.nth(i).evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual(size)
    // 表示している画像は WebP（RIFF....WEBP）
    const header = await shown.nth(i).evaluate(async (img: HTMLImageElement) => {
      const bytes = new Uint8Array(await (await fetch(img.src)).arrayBuffer())
      return [String.fromCharCode(...bytes.slice(0, 4)), String.fromCharCode(...bytes.slice(8, 12))]
    })
    expect(header).toEqual(['RIFF', 'WEBP'])
  }
  for (const image of images) expect(existsSync(thumbPath(image.filename))).toBe(true)

  // 元の画像は別に残り、「元の画像を表示」で開ける
  const original = ownerPage.getByRole('link', { name: '元の画像を表示' }).first()
  const response = await ownerPage.request.get((await original.getAttribute('href'))!)
  expect(response.status()).toBe(200)
  expect(Buffer.compare(await response.body(), wide.buffer)).toBe(0)
})
