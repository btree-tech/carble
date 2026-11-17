import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { APIRequestContext } from '@playwright/test'
import { expect, test } from '../../fixtures'
import type { ProductApi } from '../../support/api'
import { expectStatus, expectTouches, imagePart, UPLOADS, whileImporting } from '../../support/apiSpec'

// API: カード（docs/product-spec/api/cards.md）。受け付けない要求（権限）は specs/features/roles.api.spec.ts

type Content = { fieldId: number, body: string }
type Image = { id: number, filename: string }
type ListedCard = {
  id: number
  order: number
  contents: Content[]
  images: Image[]
  original: { projectId: number, id: number } | null
  duplicates: { projectId: number, id: number, project: { name: string } }[]
}

const cardsPath = (projectId: number) => `/api/projects/${projectId}/cards`

async function listCards(request: APIRequestContext, projectId: number, params: Record<string, string | number> = {}) {
  const response = await request.get(cardsPath(projectId), { params })
  await expectStatus(response, 200)
  return await response.json() as { items: ListedCard[], total: number }
}

async function addImage(request: APIRequestContext, projectId: number, cardId: number) {
  const response = await request.post(`${cardsPath(projectId)}/${cardId}/images`, { multipart: { image: imagePart() } })
  await expectStatus(response, 200)
  return await response.json() as Image
}

/** 項目「みだし」に値を入れたカードを作る */
async function addCards(ownerApi: ProductApi, projectId: number, values: string[]) {
  const cards = []
  for (const value of values) cards.push(await ownerApi.addCard(projectId, { みだし: value }))
  return cards
}

/** 並び順を ID と違う順（3, 1, 2）にする */
async function shuffleOrder(ownerApi: ProductApi, projectId: number) {
  await ownerApi.call('put', cardsPath(projectId), [{ id: 1, order: 2 }, { id: 2, order: 3 }, { id: 3, order: 1 }])
}

test.describe('GET /api/projects/{projectId}/cards（カードの一覧）', () => {
  test('200 で、カードの配列と絞り込む前の総数を返し、各カードに値・画像（追加した順）・複製元・複製先（プロジェクトの名前つき）を付ける', { tag: ['@TC-AP-CARD-LIST1', '@TC-AP-CARD-LIST8'] }, async ({ owner, ownerApi, project, requestAs, tag }) => {
    const request = await requestAs(owner)
    const [card] = await addCards(ownerApi, project.id, ['元'])
    const first = await addImage(request, project.id, card.id)
    const second = await addImage(request, project.id, card.id)
    const other = await ownerApi.createProject(`複製先${tag}`)
    await ownerApi.call('post', `${cardsPath(project.id)}/duplicate`, { cardId: [card.id], toProjectId: other.id })

    const { items, total } = await listCards(request, project.id)
    expect(total).toBe(1)
    const [midashi] = await ownerApi.fields(project.id)
    expect(items).toEqual([expect.objectContaining({
      id: card.id,
      contents: [expect.objectContaining({ fieldId: midashi.id, body: '元' })],
      images: [expect.objectContaining({ id: first.id }), expect.objectContaining({ id: second.id })],
      original: null,
      duplicates: [expect.objectContaining({ projectId: other.id, project: { name: other.name } })],
    })])

    const { items: [duplicated] } = await listCards(request, other.id)
    expect(duplicated.original).toMatchObject({ projectId: project.id, id: card.id })
  })

  test('q があると、値に q を含むカードだけにする（総数は絞り込む前の数）', { tag: ['@TC-AP-CARD-LIST2', '@TC-AP-CARD-LIST8'] }, async ({ owner, ownerApi, project, requestAs }) => {
    await addCards(ownerApi, project.id, ['土器の破片', '石器', '土器の口縁'])
    const { items, total } = await listCards(await requestAs(owner), project.id, { q: '土器' })
    expect(items.map(({ id }) => id)).toEqual([1, 3])
    expect(total).toBe(3)
  })

  test('sort が無いか id なら ID の順、order なら並び順の順、項目の ID ならその項目の値の順に並べ、同じなら ID の順にする', { tag: ['@TC-AP-CARD-LIST3', '@TC-AP-CARD-LIST4', '@TC-AP-CARD-LIST5'] }, async ({ owner, ownerApi, project, requestAs }) => {
    const request = await requestAs(owner)
    await addCards(ownerApi, project.id, ['b', 'a', 'a', 'c'])
    // 並び順を 4, 2, 3, 1 にし、2 と 3 を同じ並び順にする
    await ownerApi.call('put', cardsPath(project.id), [{ id: 1, order: 3 }, { id: 2, order: 2 }, { id: 3, order: 2 }, { id: 4, order: 1 }])
    const [midashi] = await ownerApi.fields(project.id)
    const ids = async (params: Record<string, string | number>) => (await listCards(request, project.id, params)).items.map(({ id }) => id)

    expect(await ids({})).toEqual([1, 2, 3, 4])
    expect(await ids({ sort: 'id' })).toEqual([1, 2, 3, 4])
    expect(await ids({ sort: 'order' })).toEqual([4, 2, 3, 1])
    expect(await ids({ sort: midashi.id })).toEqual([2, 3, 1, 4])
  })

  test('direction が無いか asc なら昇順、desc なら降順に並べる', { tag: ['@TC-AP-CARD-LIST6', '@TC-AP-CARD-LIST7'] }, async ({ owner, ownerApi, project, requestAs }) => {
    const request = await requestAs(owner)
    await addCards(ownerApi, project.id, ['1', '2', '3'])
    await shuffleOrder(ownerApi, project.id)
    const ids = async (params: Record<string, string | number>) => (await listCards(request, project.id, params)).items.map(({ id }) => id)

    expect(await ids({ sort: 'order' })).toEqual([3, 1, 2])
    expect(await ids({ sort: 'order', direction: 'asc' })).toEqual([3, 1, 2])
    expect(await ids({ sort: 'order', direction: 'desc' })).toEqual([2, 1, 3])
    expect(await ids({ direction: 'desc' })).toEqual([3, 2, 1])
  })

  test('sort・direction が入力の形に合わないと 400 を返す', { tag: ['@TC-AP-CARD-LIST9'] }, async ({ owner, project, requestAs }) => {
    const request = await requestAs(owner)
    await expectStatus(await request.get(cardsPath(project.id), { params: { sort: 'name' } }), 400)
    await expectStatus(await request.get(cardsPath(project.id), { params: { direction: 'up' } }), 400)
  })
})

test.describe('POST /api/projects/{projectId}/cards（カードの追加）', () => {
  test('nextToId が無いと、ID をいちばん大きい ID の次にして並び順の末尾に追加し、200 で返す', { tag: ['@TC-AP-CARD-ADD1', '@TC-AP-CARD-ADD2', '@TC-AP-CARD-ADD6'] }, async ({ owner, ownerApi, project, requestAs }) => {
    const request = await requestAs(owner)
    await addCards(ownerApi, project.id, ['1', '2'])
    // ID 1 を消して、件数（1）ではなく、いちばん大きい ID（2）の次になることを確かめる
    await ownerApi.call('delete', `${cardsPath(project.id)}/1`)

    const response = await request.post(cardsPath(project.id), { data: {} })
    await expectStatus(response, 200)
    expect(await response.json()).toMatchObject({ id: 3, images: [] })

    const { items } = await listCards(request, project.id, { sort: 'order' })
    expect(items.map(({ id }) => id)).toEqual([2, 3])
  })

  test('nextToId があると、そのカードのすぐ下に追加して並び順を 1 から振り直し、204 を返す', { tag: ['@TC-AP-CARD-ADD3', '@TC-AP-CARD-ADD7'] }, async ({ owner, ownerApi, project, requestAs }) => {
    const request = await requestAs(owner)
    await addCards(ownerApi, project.id, ['1', '2', '3'])

    await expectStatus(await request.post(cardsPath(project.id), { data: { nextToId: 1 } }), 204)

    const { items } = await listCards(request, project.id, { sort: 'order' })
    expect(items.map(({ id, order }) => [id, order])).toEqual([[1, 1], [4, 2], [2, 3], [3, 4]])
  })

  test('image があると、画像を保存してカードに付け、画像を付けたカードを返す', { tag: ['@TC-AP-CARD-ADD4', '@TC-AP-CARD-ADD6'] }, async ({ owner, project, requestAs }) => {
    const request = await requestAs(owner)
    const response = await request.post(cardsPath(project.id), { multipart: { image: imagePart() } })
    await expectStatus(response, 200)
    const added = await response.json() as { id: number, images: Image[] }
    expect(added.images).toHaveLength(1)

    const card = await (await request.get(`${cardsPath(project.id)}/${added.id}`)).json() as { images: Image[] }
    expect(card.images.map(({ id }) => id)).toEqual([added.images[0].id])
    await expectStatus(await request.get(`/uploads/images/${added.images[0].filename}`), 200)
  })

  test('本文が入力の形に合わない・nextToId のカードがプロジェクトに無い・image が画像のファイルでないと 400 を返す', { tag: ['@TC-AP-CARD-ADD8', '@TC-AP-CARD-ADD9', '@TC-AP-CARD-ADD10'] }, async ({ owner, ownerApi, project, requestAs }) => {
    const request = await requestAs(owner)
    await addCards(ownerApi, project.id, ['1'])

    await expectStatus(await request.post(cardsPath(project.id), { data: { nextToId: 'one' } }), 400)
    await expectStatus(await request.post(cardsPath(project.id), { data: { nextToId: 99 } }), 400)
    await expectStatus(await request.post(cardsPath(project.id), { multipart: { image: { ...imagePart('card/not-image.txt'), mimeType: 'text/plain' } } }), 400)
    expect((await listCards(request, project.id)).total).toBe(1)
  })
})

test.describe('PUT /api/projects/{projectId}/cards（カードの並び替え）', () => {
  test('各カードの並び順を送った値にし、最終更新日時を更新して、204 を返す', { tag: ['@TC-AP-CARD-ORD1', '@TC-AP-CARD-ORD2', '@TC-AP-CARD-ORD3'] }, async ({ owner, ownerApi, project, requestAs }) => {
    const request = await requestAs(owner)
    await addCards(ownerApi, project.id, ['1', '2', '3'])

    await expectTouches(request, project.id, async () => {
      await expectStatus(await request.put(cardsPath(project.id), { data: [{ id: 1, order: 3 }, { id: 2, order: 1 }, { id: 3, order: 2 }] }), 204)
    })

    const { items } = await listCards(request, project.id)
    expect(items.map(({ id, order }) => [id, order])).toEqual([[1, 3], [2, 1], [3, 2]])
  })

  test('本文が入力の形に合わない・送ったカードの数がプロジェクトのカードの数と違うと 400 を返す', { tag: ['@TC-AP-CARD-ORD4', '@TC-AP-CARD-ORD5'] }, async ({ owner, ownerApi, project, requestAs }) => {
    const request = await requestAs(owner)
    await addCards(ownerApi, project.id, ['1', '2'])

    await expectStatus(await request.put(cardsPath(project.id), { data: { id: 1, order: 2 } }), 400)
    await expectStatus(await request.put(cardsPath(project.id), { data: [{ id: 1, order: 2 }] }), 400)
    expect((await listCards(request, project.id)).items.map(({ order }) => order)).toEqual([1, 2])
  })
})

test.describe('DELETE /api/projects/{projectId}/cards（カードの一括削除）', () => {
  test('カードを値・画像とともに削除し、画像のファイルと縮小した画像のファイルを消し、最終更新日時を更新して、204 を返す', { tag: ['@TC-AP-CARD-BDEL1', '@TC-AP-CARD-BDEL2', '@TC-AP-CARD-BDEL3', '@TC-AP-CARD-BDEL4'] }, async ({ owner, ownerApi, project, requestAs }) => {
    const request = await requestAs(owner)
    await addCards(ownerApi, project.id, ['1', '2', '3'])
    const image = await addImage(request, project.id, 1)
    await expectStatus(await request.get(`/uploads/thumbs/${image.filename}.webp`), 200)

    await expectTouches(request, project.id, async () => {
      await expectStatus(await request.delete(cardsPath(project.id), { data: { ids: [1, 2] } }), 204)
    })

    const { items, total } = await listCards(request, project.id)
    expect(items.map(({ id }) => id)).toEqual([3])
    expect(total).toBe(1)
    expect(existsSync(join(UPLOADS, 'public/images', image.filename))).toBe(false)
    expect(existsSync(join(UPLOADS, 'public/thumbs', `${image.filename}.webp`))).toBe(false)
  })

  test('本文が入力の形に合わない・ids にプロジェクトに無いカードの ID があると 400 を返す', { tag: ['@TC-AP-CARD-BDEL5', '@TC-AP-CARD-BDEL6'] }, async ({ owner, ownerApi, project, requestAs }) => {
    const request = await requestAs(owner)
    await addCards(ownerApi, project.id, ['1'])

    await expectStatus(await request.delete(cardsPath(project.id), { data: { ids: 1 } }), 400)
    await expectStatus(await request.delete(cardsPath(project.id), { data: { ids: [1, 99] } }), 400)
    expect((await listCards(request, project.id)).total).toBe(1)
  })
})

test.describe('POST /api/projects/{projectId}/cards/duplicate（カードの複製）', () => {
  test('カードを値・画像（ファイルも）とともに複製し、複製元を覚えさせて、200 で複製したカードの配列を返す', { tag: ['@TC-AP-CARD-DUP1', '@TC-AP-CARD-DUP2', '@TC-AP-CARD-DUP8'] }, async ({ owner, ownerApi, project, requestAs }) => {
    const request = await requestAs(owner)
    const [card] = await addCards(ownerApi, project.id, ['元の値'])
    const image = await addImage(request, project.id, card.id)

    const response = await request.post(`${cardsPath(project.id)}/duplicate`, { data: { cardId: [card.id], toProjectId: project.id } })
    await expectStatus(response, 200)
    expect(await response.json()).toEqual([expect.objectContaining({ id: 2, originalProjectId: project.id, originalCardId: card.id })])

    const copy = await (await request.get(`${cardsPath(project.id)}/2`)).json() as { contents: Content[], images: Image[] }
    expect(copy.contents.map(({ body }) => body)).toEqual(['元の値'])
    expect(copy.images).toHaveLength(1)
    expect(copy.images[0].filename).not.toBe(image.filename)
    expect(existsSync(join(UPLOADS, 'public/images', copy.images[0].filename))).toBe(true)
  })

  test('toProjectId があると、そのプロジェクトの末尾に元の並び順で複製し、無い名前の項目を末尾に作って、複製先の最終更新日時を更新する', { tag: ['@TC-AP-CARD-DUP3', '@TC-AP-CARD-DUP4', '@TC-AP-CARD-DUP7'] }, async ({ owner, ownerApi, project, requestAs, tag }) => {
    const request = await requestAs(owner)
    await addCards(ownerApi, project.id, ['1', '2', '3'])
    await ownerApi.addField(project.id, '時代')
    await shuffleOrder(ownerApi, project.id)
    const target = await ownerApi.createProject(`複製先${tag}`)
    await addCards(ownerApi, target.id, ['既存'])

    await expectTouches(request, target.id, async () => {
      await expectStatus(await request.post(`${cardsPath(project.id)}/duplicate`, { data: { cardId: [1, 3], toProjectId: target.id } }), 200)
    })

    const { items } = await listCards(request, target.id, { sort: 'order' })
    expect(items.map(({ original }) => original?.id ?? null)).toEqual([null, 3, 1])
    expect((await ownerApi.fields(target.id)).map(({ name }) => name)).toEqual(['みだし', 'メモ', '時代'])
  })

  test('toProjectId が無いと、「無題のプロジェクト」を作ってそこに複製する', { tag: ['@TC-AP-CARD-DUP5'] }, async ({ owner, ownerApi, project, requestAs }) => {
    const request = await requestAs(owner)
    const [card] = await addCards(ownerApi, project.id, ['元'])

    const response = await request.post(`${cardsPath(project.id)}/duplicate`, { data: { cardId: [card.id] } })
    await expectStatus(response, 200)
    const [duplicated] = await response.json() as { projectId: number, id: number, originalCardId: number }[]
    // 作ったプロジェクトは、オーナーが設定されず開けない（docs/ISSUES.md「新しいプロジェクトに複製するとプロジェクトを開けない」）ので、返したカードで確かめる
    expect(duplicated.projectId).not.toBe(project.id)
    expect(duplicated).toMatchObject({ id: 1, originalCardId: card.id })
  })

  test('nextToId があると、そのカードのすぐ下に複製し、複製先の並び順を 1 から振り直す', { tag: ['@TC-AP-CARD-DUP6'] }, async ({ owner, ownerApi, project, requestAs }) => {
    const request = await requestAs(owner)
    await addCards(ownerApi, project.id, ['1', '2', '3'])

    await expectStatus(await request.post(`${cardsPath(project.id)}/duplicate`, { data: { cardId: [1], toProjectId: project.id, nextToId: 1 } }), 200)

    const { items } = await listCards(request, project.id, { sort: 'order' })
    expect(items.map(({ id, order }) => [id, order])).toEqual([[1, 1], [4, 2], [2, 3], [3, 4]])
  })

  test('本文が入力の形に合わない・toProjectId のプロジェクトが無いと 400 を返す', { tag: ['@TC-AP-CARD-DUP9', '@TC-AP-CARD-DUP10'] }, async ({ owner, ownerApi, project, requestAs }) => {
    const request = await requestAs(owner)
    await addCards(ownerApi, project.id, ['1'])

    await expectStatus(await request.post(`${cardsPath(project.id)}/duplicate`, { data: { cardId: [] } }), 400)
    await expectStatus(await request.post(`${cardsPath(project.id)}/duplicate`, { data: { cardId: [1], toProjectId: 2_000_000_000 } }), 400)
    expect((await listCards(request, project.id)).total).toBe(1)
  })
})

test.describe('GET /api/projects/{projectId}/cards/{cardId}（カードの取得）', () => {
  test('200 で、カードに値と画像（追加した順）を付けて返す', { tag: ['@TC-AP-CARD-GET1', '@TC-AP-CARD-GET2'] }, async ({ owner, ownerApi, project, requestAs }) => {
    const request = await requestAs(owner)
    const [card] = await addCards(ownerApi, project.id, ['値'])
    const first = await addImage(request, project.id, card.id)
    const second = await addImage(request, project.id, card.id)

    const response = await request.get(`${cardsPath(project.id)}/${card.id}`)
    await expectStatus(response, 200)
    const body = await response.json() as { id: number, projectId: number, contents: Content[], images: Image[] }
    expect(body).toMatchObject({ id: card.id, projectId: project.id })
    expect(body.contents.map(({ body }) => body)).toEqual(['値'])
    expect(body.images.map(({ id }) => id)).toEqual([first.id, second.id])
  })

  test('cardId のカードがプロジェクトに無いと 404 を返す', { tag: ['@TC-AP-CARD-GET3'] }, async ({ owner, project, requestAs }) => {
    await expectStatus(await (await requestAs(owner)).get(`${cardsPath(project.id)}/99`), 404)
  })
})

test.describe('DELETE /api/projects/{projectId}/cards/{cardId}（カードの削除）', () => {
  test('カードを値・画像とともに削除し、画像のファイルと縮小した画像のファイルを消し、最終更新日時を更新して、204 を返す', { tag: ['@TC-AP-CARD-DEL1', '@TC-AP-CARD-DEL2', '@TC-AP-CARD-DEL3', '@TC-AP-CARD-DEL4'] }, async ({ owner, ownerApi, project, requestAs }) => {
    const request = await requestAs(owner)
    const [card] = await addCards(ownerApi, project.id, ['値', '残す'])
    const image = await addImage(request, project.id, card.id)
    await expectStatus(await request.get(`/uploads/thumbs/${image.filename}.webp`), 200)

    await expectTouches(request, project.id, async () => {
      await expectStatus(await request.delete(`${cardsPath(project.id)}/${card.id}`), 204)
    })

    await expectStatus(await request.get(`${cardsPath(project.id)}/${card.id}`), 404)
    expect((await listCards(request, project.id)).items.map(({ id }) => id)).toEqual([2])
    expect(existsSync(join(UPLOADS, 'public/images', image.filename))).toBe(false)
    expect(existsSync(join(UPLOADS, 'public/thumbs', `${image.filename}.webp`))).toBe(false)
  })

  test('cardId のカードがプロジェクトに無いと 404 を返す', { tag: ['@TC-AP-CARD-DEL5'] }, async ({ owner, project, requestAs }) => {
    await expectStatus(await (await requestAs(owner)).delete(`${cardsPath(project.id)}/99`), 404)
  })
})

test.describe('PUT /api/projects/{projectId}/cards/{cardId}/fields/{fieldId}（値の保存）', () => {
  test('値がまだ無ければ作り、あれば書き換え、最終更新日時を更新して、200 で保存した値を返す', { tag: ['@TC-AP-CARD-VAL1', '@TC-AP-CARD-VAL2', '@TC-AP-CARD-VAL3', '@TC-AP-CARD-VAL4'] }, async ({ owner, ownerApi, project, requestAs }) => {
    const request = await requestAs(owner)
    const card = await ownerApi.addCard(project.id)
    const [, memo] = await ownerApi.fields(project.id)
    const path = `${cardsPath(project.id)}/${card.id}/fields/${memo.id}`

    await expectTouches(request, project.id, async () => {
      const created = await request.put(path, { data: { body: '最初' } })
      await expectStatus(created, 200)
      expect(await created.json()).toMatchObject({ cardId: card.id, fieldId: memo.id, body: '最初' })
    })

    const updated = await request.put(path, { data: { body: '書き換え' } })
    await expectStatus(updated, 200)
    expect(await updated.json()).toMatchObject({ cardId: card.id, fieldId: memo.id, body: '書き換え' })

    const saved = await (await request.get(`${cardsPath(project.id)}/${card.id}`)).json() as { contents: Content[] }
    expect(saved.contents).toEqual([expect.objectContaining({ fieldId: memo.id, body: '書き換え' })])
  })

  test('本文が入力の形に合わないと 400、cardId のカード・fieldId の項目がプロジェクトに無いと 404 を返す', { tag: ['@TC-AP-CARD-VAL5', '@TC-AP-CARD-VAL6', '@TC-AP-CARD-VAL7'] }, async ({ owner, ownerApi, project, requestAs }) => {
    const request = await requestAs(owner)
    const card = await ownerApi.addCard(project.id)
    const [midashi] = await ownerApi.fields(project.id)

    await expectStatus(await request.put(`${cardsPath(project.id)}/${card.id}/fields/${midashi.id}`, { data: { body: 1 } }), 400)
    await expectStatus(await request.put(`${cardsPath(project.id)}/99/fields/${midashi.id}`, { data: { body: '値' } }), 404)
    await expectStatus(await request.put(`${cardsPath(project.id)}/${card.id}/fields/2000000000`, { data: { body: '値' } }), 404)
  })
})

test('取り込み待ち・取り込み中のインポートがあると、カードの API は 409 を返す', { tag: ['@TC-AP-CARD-LIST10', '@TC-AP-CARD-ADD11', '@TC-AP-CARD-ORD6', '@TC-AP-CARD-BDEL7', '@TC-AP-CARD-DUP11', '@TC-AP-CARD-GET4', '@TC-AP-CARD-DEL6', '@TC-AP-CARD-VAL8'] }, async ({ owner, ownerApi, project, requestAs }) => {
  const request = await requestAs(owner)
  const card = await ownerApi.addCard(project.id)
  const [midashi] = await ownerApi.fields(project.id)
  const base = cardsPath(project.id)

  await whileImporting(request, project.id, async () => {
    await expectStatus(await request.get(base), 409)
    await expectStatus(await request.post(base, { data: {} }), 409)
    await expectStatus(await request.put(base, { data: [{ id: card.id, order: 1 }] }), 409)
    await expectStatus(await request.delete(base, { data: { ids: [card.id] } }), 409)
    await expectStatus(await request.post(`${base}/duplicate`, { data: { cardId: [card.id], toProjectId: project.id } }), 409)
    await expectStatus(await request.get(`${base}/${card.id}`), 409)
    await expectStatus(await request.delete(`${base}/${card.id}`), 409)
    await expectStatus(await request.put(`${base}/${card.id}/fields/${midashi.id}`, { data: { body: '値' } }), 409)
  })
})
