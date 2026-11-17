import { expect, test } from '../../fixtures'
import { expectStatus, expectTouches, whileImporting } from '../../support/apiSpec'

// API: 項目（docs/product-spec/api/fields.md）。受け付けない要求（権限）は specs/features/roles.api.spec.ts

const fieldsPath = (projectId: number) => `/api/projects/${projectId}/fields`

test.describe('POST /api/projects/{projectId}/fields（項目の追加）', () => {
  test('項目を項目の末尾に追加し、最終更新日時を更新して、200 で追加した項目を返す', { tag: ['@TC-AP-FIELD-ADD1', '@TC-AP-FIELD-ADD2', '@TC-AP-FIELD-ADD3'] }, async ({ owner, ownerApi, project, requestAs }) => {
    const request = await requestAs(owner)

    await expectTouches(request, project.id, async () => {
      const response = await request.post(fieldsPath(project.id), { data: { name: '時代' } })
      await expectStatus(response, 200)
      expect(await response.json()).toMatchObject({ name: '時代', order: 3 })
    })

    expect((await ownerApi.fields(project.id)).map(({ name }) => name)).toEqual(['みだし', 'メモ', '時代'])
  })

  test('本文が入力の形に合わないと 400 を返す', { tag: ['@TC-AP-FIELD-ADD4'] }, async ({ owner, ownerApi, project, requestAs }) => {
    const request = await requestAs(owner)
    await expectStatus(await request.post(fieldsPath(project.id), { data: {} }), 400)
    await expectStatus(await request.post(fieldsPath(project.id), { data: { name: 1 } }), 400)
    expect(await ownerApi.fields(project.id)).toHaveLength(2)
  })
})

test.describe('PUT /api/projects/{projectId}/fields（項目の並び替え）', () => {
  test('各項目の並び順を送った値にし、最終更新日時を更新して、204 を返す', { tag: ['@TC-AP-FIELD-ORD1', '@TC-AP-FIELD-ORD2', '@TC-AP-FIELD-ORD3'] }, async ({ owner, ownerApi, project, requestAs }) => {
    const request = await requestAs(owner)
    const [midashi, memo] = await ownerApi.fields(project.id)

    await expectTouches(request, project.id, async () => {
      await expectStatus(await request.put(fieldsPath(project.id), { data: [{ id: midashi.id, order: 2 }, { id: memo.id, order: 1 }] }), 204)
    })

    expect((await ownerApi.fields(project.id)).map(({ name, order }) => [name, order])).toEqual([['メモ', 1], ['みだし', 2]])
  })

  test('本文が入力の形に合わない・送った項目の数が違う・並び順が重なっていると 400 を返す', { tag: ['@TC-AP-FIELD-ORD4', '@TC-AP-FIELD-ORD5', '@TC-AP-FIELD-ORD6'] }, async ({ owner, ownerApi, project, requestAs }) => {
    const request = await requestAs(owner)
    const [midashi, memo] = await ownerApi.fields(project.id)

    await expectStatus(await request.put(fieldsPath(project.id), { data: { id: midashi.id, order: 2 } }), 400)
    await expectStatus(await request.put(fieldsPath(project.id), { data: [{ id: midashi.id, order: 2 }] }), 400)
    await expectStatus(await request.put(fieldsPath(project.id), { data: [{ id: midashi.id, order: 1 }, { id: memo.id, order: 1 }] }), 400)
    expect((await ownerApi.fields(project.id)).map(({ name }) => name)).toEqual(['みだし', 'メモ'])
  })
})

test.describe('PUT /api/projects/{projectId}/fields/{fieldId}（項目の変更）', () => {
  test('name があると項目名を name にし、最終更新日時を更新して、204 を返す', { tag: ['@TC-AP-FIELD-UPD1', '@TC-AP-FIELD-UPD3', '@TC-AP-FIELD-UPD4'] }, async ({ owner, ownerApi, project, requestAs }) => {
    const request = await requestAs(owner)
    const [midashi] = await ownerApi.fields(project.id)

    await expectTouches(request, project.id, async () => {
      await expectStatus(await request.put(`${fieldsPath(project.id)}/${midashi.id}`, { data: { name: '見出し' } }), 204)
    })

    expect((await ownerApi.fields(project.id))[0]).toMatchObject({ id: midashi.id, name: '見出し', isVisible: true })
  })

  test('isVisible があると、項目の表示・非表示を isVisible にする', { tag: ['@TC-AP-FIELD-UPD2', '@TC-AP-FIELD-UPD4'] }, async ({ owner, ownerApi, project, requestAs }) => {
    const request = await requestAs(owner)
    const [midashi] = await ownerApi.fields(project.id)
    const path = `${fieldsPath(project.id)}/${midashi.id}`

    await expectStatus(await request.put(path, { data: { isVisible: false } }), 204)
    expect((await ownerApi.fields(project.id))[0]).toMatchObject({ id: midashi.id, name: 'みだし', isVisible: false })

    await expectStatus(await request.put(path, { data: { isVisible: true } }), 204)
    expect((await ownerApi.fields(project.id))[0]).toMatchObject({ id: midashi.id, isVisible: true })
  })

  test('本文が入力の形に合わないと 400、fieldId の項目がプロジェクトに無いと 404 を返す', { tag: ['@TC-AP-FIELD-UPD5', '@TC-AP-FIELD-UPD6'] }, async ({ owner, ownerApi, project, requestAs }) => {
    const request = await requestAs(owner)
    const [midashi] = await ownerApi.fields(project.id)

    await expectStatus(await request.put(`${fieldsPath(project.id)}/${midashi.id}`, { data: {} }), 400)
    await expectStatus(await request.put(`${fieldsPath(project.id)}/${midashi.id}`, { data: { isVisible: 'no' } }), 400)
    await expectStatus(await request.put(`${fieldsPath(project.id)}/2000000000`, { data: { name: '見出し' } }), 404)
  })
})

test.describe('DELETE /api/projects/{projectId}/fields/{fieldId}（項目の削除）', () => {
  test('項目を各カードのその項目の値とともに削除し、最終更新日時を更新して、204 を返す', { tag: ['@TC-AP-FIELD-DEL1', '@TC-AP-FIELD-DEL2', '@TC-AP-FIELD-DEL3'] }, async ({ owner, ownerApi, project, requestAs }) => {
    const request = await requestAs(owner)
    const card = await ownerApi.addCard(project.id, { みだし: '消える', メモ: '残る' })
    const [midashi, memo] = await ownerApi.fields(project.id)

    await expectTouches(request, project.id, async () => {
      await expectStatus(await request.delete(`${fieldsPath(project.id)}/${midashi.id}`), 204)
    })

    expect((await ownerApi.fields(project.id)).map(({ id }) => id)).toEqual([memo.id])
    const saved = await (await request.get(`/api/projects/${project.id}/cards/${card.id}`)).json() as { contents: { fieldId: number, body: string }[] }
    expect(saved.contents.map(({ fieldId, body }) => [fieldId, body])).toEqual([[memo.id, '残る']])
  })

  test('fieldId の項目がプロジェクトに無いと 404 を返す', { tag: ['@TC-AP-FIELD-DEL4'] }, async ({ owner, project, requestAs }) => {
    await expectStatus(await (await requestAs(owner)).delete(`${fieldsPath(project.id)}/2000000000`), 404)
  })
})

test('取り込み待ち・取り込み中のインポートがあると、項目の API は 409 を返す', { tag: ['@TC-AP-FIELD-ADD5', '@TC-AP-FIELD-ORD7', '@TC-AP-FIELD-UPD7', '@TC-AP-FIELD-DEL5'] }, async ({ owner, ownerApi, project, requestAs }) => {
  const request = await requestAs(owner)
  const [midashi, memo] = await ownerApi.fields(project.id)
  const base = fieldsPath(project.id)

  await whileImporting(request, project.id, async () => {
    await expectStatus(await request.post(base, { data: { name: '時代' } }), 409)
    await expectStatus(await request.put(base, { data: [{ id: midashi.id, order: 2 }, { id: memo.id, order: 1 }] }), 409)
    await expectStatus(await request.put(`${base}/${midashi.id}`, { data: { name: '見出し' } }), 409)
    await expectStatus(await request.delete(`${base}/${midashi.id}`), 409)
  })
})
