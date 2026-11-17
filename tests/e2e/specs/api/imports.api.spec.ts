import type { APIRequestContext } from '@playwright/test'
import { expect, test } from '../../fixtures'
import { expectStatus, registerImport, testFile } from '../../support/apiSpec'

// API: インポート（docs/product-spec/api/imports.md）。受け付けない要求（権限）は specs/features/roles.api.spec.ts
// 登録したインポートは毎分の取り込みで状態が変わる（取り込み待ち → 取り込み中 → 終わった後の順で、戻らない）

type Import = { id: number, status: string, originalFilename: string, options: { update: boolean }, notifiedAt: string | null, createdAt: string }
type ImportList = { items: Import[], total: number, pageCount: number }

const importsPath = (projectId: number) => `/api/projects/${projectId}/imports`
const FINISHED = ['DONE', 'ABORT', 'FORMAT_ERROR', 'SYSTEM_ERROR']

async function list(request: APIRequestContext, projectId: number, params: string | Record<string, string | number> = {}) {
  const response = await request.get(importsPath(projectId), { params })
  await expectStatus(response, 200)
  return await response.json() as ImportList
}

test.describe('GET /api/projects/{projectId}/imports（インポートの一覧）', () => {
  test('200 で、プロジェクトのインポートを登録の新しい順に並べ、page のページの pageCount 件と総数・1 ページの件数を返す', { tag: ['@TC-AP-IMPORT-LIST1', '@TC-AP-IMPORT-LIST4', '@TC-AP-IMPORT-LIST5'] }, async ({ owner, ownerApi, project, requestAs, tag }) => {
    const request = await requestAs(owner)
    const first = await registerImport(request, project.id)
    const second = await registerImport(request, project.id)
    // ほかのプロジェクトのインポートは含めない
    const other = await ownerApi.createProject(`ほか${tag}`)
    await registerImport(request, other.id)

    const { items, total, pageCount } = await list(request, project.id)
    expect({ total, pageCount }).toEqual({ total: 2, pageCount: 10 })
    expect(items.map(({ id }) => id).sort()).toEqual([first.id, second.id].sort())
    // 登録の日時は秒の単位で、同じ秒に登録したものの順は決まらないので、新しい順に並んでいることだけを確かめる
    const times = items.map(({ createdAt }) => new Date(createdAt).getTime())
    expect(times).toEqual([...times].sort((a, b) => b - a))

    // 1 ページを 1 件にすると、1 ページ目と 2 ページ目に 1 件ずつ分かれる
    const page1 = await list(request, project.id, { pageCount: 1 })
    const page2 = await list(request, project.id, { pageCount: 1, page: 2 })
    expect({ total: page1.total, pageCount: page1.pageCount }).toEqual({ total: 2, pageCount: 1 })
    expect([...page1.items, ...page2.items].map(({ id }) => id).sort()).toEqual([first.id, second.id].sort())
  })

  test('status があると、そのどれかの状態のインポートだけにする', { tag: ['@TC-AP-IMPORT-LIST2'] }, async ({ owner, project, requestAs }) => {
    const request = await requestAs(owner)
    const registered = await registerImport(request, project.id)

    // 状態は戻らないので、取り込みの前半（待ち・取り込み中）→ 後半（終わった後）の順に取れば、どちらかに必ず入る
    const before = await list(request, project.id, 'status=OPEN&status=IN_PROGRESS')
    const after = await list(request, project.id, FINISHED.map((status) => `status=${status}`).join('&'))
    for (const { status } of before.items) expect(['OPEN', 'IN_PROGRESS']).toContain(status)
    for (const { status } of after.items) expect(FINISHED).toContain(status)
    expect([...before.items, ...after.items].map(({ id }) => id)).toContain(registered.id)
  })

  test('unnotified が true だと、結果を知らせていないインポートだけにする', { tag: ['@TC-AP-IMPORT-LIST3'] }, async ({ owner, project, requestAs }) => {
    const request = await requestAs(owner)
    const notified = await registerImport(request, project.id)
    const unnotified = await registerImport(request, project.id)
    await expectStatus(await request.put(`${importsPath(project.id)}/${notified.id}`, { data: { notified: true } }), 200)

    const { items, total } = await list(request, project.id, { unnotified: 'true' })
    expect(items.map(({ id }) => id)).toEqual([unnotified.id])
    expect(total).toBe(1)
  })

  test('クエリが入力の形に合わないと 400 を返す', { tag: ['@TC-AP-IMPORT-LIST6'] }, async ({ owner, project, requestAs }) => {
    await expectStatus(await (await requestAs(owner)).get(importsPath(project.id), { params: 'status=OPEN&status=WAITING' }), 400)
  })
})

test.describe('POST /api/projects/{projectId}/imports（インポートの登録）', () => {
  test('ファイルを保存し、インポートを取り込み待ち（OPEN）として登録して、200 で返す', { tag: ['@TC-AP-IMPORT-ADD1', '@TC-AP-IMPORT-ADD3'] }, async ({ owner, project, requestAs }) => {
    const request = await requestAs(owner)
    const response = await request.post(importsPath(project.id), { multipart: { file: { name: 'cards.csv', mimeType: 'text/csv', buffer: testFile('settings/cards.csv') } } })
    await expectStatus(response, 200)
    const registered = await response.json() as Import
    expect(registered).toMatchObject({ status: 'OPEN', originalFilename: 'cards.csv', options: { update: false } })

    expect((await list(request, project.id)).items.map(({ id }) => id)).toEqual([registered.id])
  })

  test('update が true だと、同じ ID のカードを上書きするインポートにする', { tag: ['@TC-AP-IMPORT-ADD2'] }, async ({ owner, project, requestAs }) => {
    const response = await (await requestAs(owner)).post(importsPath(project.id), {
      multipart: { file: { name: 'cards.csv', mimeType: 'text/csv', buffer: testFile('settings/cards.csv') }, update: 'true' },
    })
    await expectStatus(response, 200)
    expect((await response.json() as Import).options).toEqual({ update: true })
  })

  test('file が無いか、zip・CSV・エクセルのファイルでないと 422 を返す', { tag: ['@TC-AP-IMPORT-ADD4'] }, async ({ owner, project, requestAs }) => {
    const request = await requestAs(owner)
    await expectStatus(await request.post(importsPath(project.id), { multipart: { update: 'true' } }), 422)
    await expectStatus(await request.post(importsPath(project.id), { multipart: { file: { name: 'memo.txt', mimeType: 'text/plain', buffer: testFile('settings/memo.txt') } } }), 422)
    expect((await list(request, project.id)).total).toBe(0)
  })
})

test.describe('PUT /api/projects/{projectId}/imports/{importId}（インポートの結果を知らせたことの記録）', () => {
  test('結果を知らせた日時を記録し、200 で記録したインポートを返す', { tag: ['@TC-AP-IMPORT-NTFY1', '@TC-AP-IMPORT-NTFY2'] }, async ({ owner, project, requestAs }) => {
    const request = await requestAs(owner)
    const registered = await registerImport(request, project.id)

    const response = await request.put(`${importsPath(project.id)}/${registered.id}`, { data: { notified: true } })
    await expectStatus(response, 200)
    const updated = await response.json() as Import
    expect(updated.id).toBe(registered.id)
    expect(updated.notifiedAt).not.toBeNull()

    const { items } = await list(request, project.id)
    expect(items.find(({ id }) => id === registered.id)?.notifiedAt).toBe(updated.notifiedAt)
  })

  test('importId のインポートがプロジェクトに無いと 404、本文が入力の形に合わないと 400 を返す', { tag: ['@TC-AP-IMPORT-NTFY3', '@TC-AP-IMPORT-NTFY4'] }, async ({ owner, project, requestAs }) => {
    const request = await requestAs(owner)
    const registered = await registerImport(request, project.id)

    await expectStatus(await request.put(`${importsPath(project.id)}/2000000000`, { data: { notified: true } }), 404)
    await expectStatus(await request.put(`${importsPath(project.id)}/${registered.id}`, { data: { notified: false } }), 400)
    expect((await list(request, project.id)).items.find(({ id }) => id === registered.id)?.notifiedAt).toBeNull()
  })
})
