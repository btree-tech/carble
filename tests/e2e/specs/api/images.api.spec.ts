import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { APIRequestContext } from '@playwright/test'
import { expect, test } from '../../fixtures'
import { expectStatus, expectTouches, imagePart, testFile, UPLOADS, whileImporting } from '../../support/apiSpec'

// API: 画像（docs/product-spec/api/images.md）。受け付けない要求（権限）は specs/features/roles.api.spec.ts

const WIDE = 'settings/wide.png' // 1000×500
const SMALL = 'settings/small.png' // 100×50

type Image = { id: number, cardId: number, filename: string }

const imagesPath = (projectId: number, cardId: number) => `/api/projects/${projectId}/cards/${cardId}/images`

async function addImage(request: APIRequestContext, projectId: number, cardId: number, path = SMALL) {
  const response = await request.post(imagesPath(projectId, cardId), { multipart: { image: imagePart(path) } })
  await expectStatus(response, 200)
  return await response.json() as Image
}

/** WebP の画像の大きさ（RIFF の最初のチャンクの種類ごとに読む） */
function webpSize(buffer: Buffer) {
  expect(buffer.subarray(0, 4).toString()).toBe('RIFF')
  expect(buffer.subarray(8, 12).toString()).toBe('WEBP')
  const chunk = buffer.subarray(12, 16).toString()
  if (chunk === 'VP8 ') return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff }
  if (chunk === 'VP8L') {
    const bits = buffer.readUInt32LE(21)
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
  }
  if (chunk === 'VP8X') return { width: buffer.readUIntLE(24, 3) + 1, height: buffer.readUIntLE(27, 3) + 1 }
  throw new Error(`知らない WebP のチャンク: ${chunk}`)
}

test.describe('POST /api/projects/{projectId}/cards/{cardId}/images（画像の追加）', () => {
  test('画像を保存してカードに付け、最終更新日時を更新して、200 で追加した画像を返す', { tag: ['@TC-AP-IMAGE-ADD1', '@TC-AP-IMAGE-ADD2', '@TC-AP-IMAGE-ADD3'] }, async ({ owner, ownerApi, project, requestAs }) => {
    const request = await requestAs(owner)
    const card = await ownerApi.addCard(project.id)

    let image: Image | undefined
    await expectTouches(request, project.id, async () => {
      image = await addImage(request, project.id, card.id)
    })
    expect(image!.cardId).toBe(card.id)

    const saved = await (await request.get(`/api/projects/${project.id}/cards/${card.id}`)).json() as { images: Image[] }
    expect(saved.images.map(({ id, filename }) => [id, filename])).toEqual([[image!.id, image!.filename]])
    expect(existsSync(join(UPLOADS, 'public/images', image!.filename))).toBe(true)
  })

  test('image が無いか画像のファイルでないと 400、cardId のカードがプロジェクトに無いと 404 を返す', { tag: ['@TC-AP-IMAGE-ADD4', '@TC-AP-IMAGE-ADD5'] }, async ({ owner, ownerApi, project, requestAs }) => {
    const request = await requestAs(owner)
    const card = await ownerApi.addCard(project.id)

    await expectStatus(await request.post(imagesPath(project.id, card.id), { multipart: { other: 'x' } }), 400)
    await expectStatus(await request.post(imagesPath(project.id, card.id), { multipart: { image: { ...imagePart('card/not-image.txt'), mimeType: 'text/plain' } } }), 400)
    await expectStatus(await request.post(imagesPath(project.id, 99), { multipart: { image: imagePart(SMALL) } }), 404)
    const saved = await (await request.get(`/api/projects/${project.id}/cards/${card.id}`)).json() as { images: Image[] }
    expect(saved.images).toEqual([])
  })
})

test.describe('DELETE /api/projects/{projectId}/cards/{cardId}/images/{imageId}（画像の削除）', () => {
  test('画像を削除し、画像のファイルと縮小した画像のファイルを消し、最終更新日時を更新して、204 を返す', { tag: ['@TC-AP-IMAGE-DEL1', '@TC-AP-IMAGE-DEL2', '@TC-AP-IMAGE-DEL3', '@TC-AP-IMAGE-DEL4'] }, async ({ owner, ownerApi, project, requestAs }) => {
    const request = await requestAs(owner)
    const card = await ownerApi.addCard(project.id)
    const image = await addImage(request, project.id, card.id)
    // 縮小した画像は初めて表示するときに作る
    await expectStatus(await request.get(`/uploads/thumbs/${image.filename}.webp`), 200)
    expect(existsSync(join(UPLOADS, 'public/thumbs', `${image.filename}.webp`))).toBe(true)

    await expectTouches(request, project.id, async () => {
      await expectStatus(await request.delete(`${imagesPath(project.id, card.id)}/${image.id}`), 204)
    })

    const saved = await (await request.get(`/api/projects/${project.id}/cards/${card.id}`)).json() as { images: Image[] }
    expect(saved.images).toEqual([])
    expect(existsSync(join(UPLOADS, 'public/images', image.filename))).toBe(false)
    expect(existsSync(join(UPLOADS, 'public/thumbs', `${image.filename}.webp`))).toBe(false)
  })

  test('cardId のカードがプロジェクトに無い・imageId の画像が無いと 404 を返す', { tag: ['@TC-AP-IMAGE-DEL5', '@TC-AP-IMAGE-DEL6'] }, async ({ owner, ownerApi, project, requestAs }) => {
    const request = await requestAs(owner)
    const card = await ownerApi.addCard(project.id)
    const image = await addImage(request, project.id, card.id)

    await expectStatus(await request.delete(`${imagesPath(project.id, 99)}/${image.id}`), 404)
    await expectStatus(await request.delete(`${imagesPath(project.id, card.id)}/2000000000`), 404)
    expect(existsSync(join(UPLOADS, 'public/images', image.filename))).toBe(true)
  })
})

test.describe('GET /uploads/images/{filename}（画像のファイル）', () => {
  test('200 で画像のファイルを返す', { tag: ['@TC-AP-IMAGE-FILE1', '@TC-AP-IMAGE-FILE2'] }, async ({ owner, ownerApi, project, requestAs }) => {
    const request = await requestAs(owner)
    const card = await ownerApi.addCard(project.id)
    const image = await addImage(request, project.id, card.id)

    const response = await request.get(`/uploads/images/${image.filename}`)
    await expectStatus(response, 200)
    expect(Buffer.compare(await response.body(), testFile(SMALL))).toBe(0)
  })

  test('filename のファイルが無いと 404 を返す', { tag: ['@TC-AP-IMAGE-FILE3'] }, async ({ owner, requestAs }) => {
    await expectStatus(await (await requestAs(owner)).get('/uploads/images/no-such-file.png'), 404)
  })
})

test.describe('GET /uploads/thumbs/{filename}（縮小した画像のファイル）', () => {
  test('縮小した画像がまだ無いと、長辺 640px 以内に縮小した画像（WebP）を作り、200 で返す', { tag: ['@TC-AP-IMAGE-THUM1', '@TC-AP-IMAGE-THUM3'] }, async ({ owner, ownerApi, project, requestAs }) => {
    const request = await requestAs(owner)
    const card = await ownerApi.addCard(project.id)
    const wide = await addImage(request, project.id, card.id, WIDE)
    const small = await addImage(request, project.id, card.id, SMALL)
    expect(existsSync(join(UPLOADS, 'public/thumbs', `${wide.filename}.webp`))).toBe(false)

    const response = await request.get(`/uploads/thumbs/${wide.filename}.webp`)
    await expectStatus(response, 200)
    expect(webpSize(await response.body())).toEqual({ width: 640, height: 320 })
    expect(existsSync(join(UPLOADS, 'public/thumbs', `${wide.filename}.webp`))).toBe(true)

    // 元の画像より大きくはしない
    expect(webpSize(await (await request.get(`/uploads/thumbs/${small.filename}.webp`)).body())).toEqual({ width: 100, height: 50 })
  })

  test('縮小した画像があると、作った縮小した画像を使う', { tag: ['@TC-AP-IMAGE-THUM2', '@TC-AP-IMAGE-THUM3'] }, async ({ owner, ownerApi, project, requestAs }) => {
    const request = await requestAs(owner)
    const card = await ownerApi.addCard(project.id)
    const image = await addImage(request, project.id, card.id, WIDE)
    const first = await (await request.get(`/uploads/thumbs/${image.filename}.webp`)).body()
    const thumb = join(UPLOADS, 'public/thumbs', `${image.filename}.webp`)
    const created = statSync(thumb).mtimeMs

    const response = await request.get(`/uploads/thumbs/${image.filename}.webp`)
    await expectStatus(response, 200)
    expect(Buffer.compare(await response.body(), first)).toBe(0)
    // 作り直していない
    expect(statSync(thumb).mtimeMs).toBe(created)
  })

  test('元の画像のファイルが無いと 404 を返す', { tag: ['@TC-AP-IMAGE-THUM4'] }, async ({ owner, requestAs }) => {
    await expectStatus(await (await requestAs(owner)).get('/uploads/thumbs/no-such-file.png.webp'), 404)
  })
})

test('取り込み待ち・取り込み中のインポートがあると、画像の追加・削除は 409 を返す', { tag: ['@TC-AP-IMAGE-ADD6', '@TC-AP-IMAGE-DEL7'] }, async ({ owner, ownerApi, project, requestAs }) => {
  const request = await requestAs(owner)
  const card = await ownerApi.addCard(project.id)
  const image = await addImage(request, project.id, card.id)

  await whileImporting(request, project.id, async () => {
    await expectStatus(await request.post(imagesPath(project.id, card.id), { multipart: { image: imagePart(SMALL) } }), 409)
    await expectStatus(await request.delete(`${imagesPath(project.id, card.id)}/${image.id}`), 409)
  })
})
