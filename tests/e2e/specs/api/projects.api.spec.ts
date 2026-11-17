import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '../../fixtures'
import { expectStatus, expectTouches, imagePart, UPLOADS, whileImporting } from '../../support/apiSpec'

// API: プロジェクト（docs/product-spec/api/projects.md）。受け付けない要求（権限）は specs/features/roles.api.spec.ts

type ListedProject = {
  id: number
  name: string
  users: { role: string, user: { name: string } }[]
  imports: { id: number }[]
}

test.describe('GET /api/projects（プロジェクトの一覧）', () => {
  test('status が無いと、自分がメンバー（招待中を除く）のプロジェクトを、最終更新日時の新しい順に返す', { tag: ['@TC-AP-PROJ-LIST1', '@TC-AP-PROJ-LIST3'] }, async ({ owner, ownerApi, newAccount, apiAs, requestAs, tag }) => {
    const older = await ownerApi.createProject(`古い${tag}`)
    const newer = await ownerApi.createProject(`新しい${tag}`)
    // 別のオーナーから招待されているだけのプロジェクトは含めない
    const other = await apiAs(await newAccount({ suffix: 'other' }))
    const invited = await other.createProject(`招待${tag}`)
    await other.invite(invited.id, owner.username!)
    const request = await requestAs(owner)

    // 古い方を変えて、新しい方より後の最終更新日時にする
    await expectTouches(request, older.id, () => request.put(`/api/projects/${older.id}`, { data: { name: `古い${tag}` } }))

    const response = await request.get('/api/projects')
    await expectStatus(response, 200)
    expect((await response.json() as ListedProject[]).map(({ id }) => id)).toEqual([older.id, newer.id])
  })

  test('status が invited なら、自分を招待しているプロジェクトを返す', { tag: ['@TC-AP-PROJ-LIST2'] }, async ({ ownerApi, project, newAccount, requestAs }) => {
    const invitee = await newAccount({ suffix: 'invitee' })
    await ownerApi.invite(project.id, invitee.username!)

    const response = await (await requestAs(invitee)).get('/api/projects', { params: { status: 'invited' } })
    await expectStatus(response, 200)
    expect((await response.json() as ListedProject[]).map(({ id }) => id)).toEqual([project.id])
  })

  test('200 で、各プロジェクトにオーナーの名前と、取り込み待ち・取り込み中のインポートを付けた配列を返す', { tag: ['@TC-AP-PROJ-LIST4'] }, async ({ owner, ownerApi, project, requestAs, tag }) => {
    const request = await requestAs(owner)
    const quiet = await ownerApi.createProject(`インポートなし${tag}`)

    await whileImporting(request, project.id, async () => {
      const projects = await (await request.get('/api/projects')).json() as ListedProject[]
      const byId = new Map(projects.map((p) => [p.id, p]))
      expect(byId.get(project.id)?.users.map(({ user }) => user.name)).toEqual([owner.name])
      expect(byId.get(project.id)?.imports).toHaveLength(1)
      expect(byId.get(quiet.id)?.imports).toEqual([])
    })
  })

  test('status が invited 以外なら 400 を返す', { tag: ['@TC-AP-PROJ-LIST5'] }, async ({ owner, requestAs }) => {
    await expectStatus(await (await requestAs(owner)).get('/api/projects', { params: { status: 'owner' } }), 400)
  })
})

test.describe('POST /api/projects（プロジェクトの作成）', () => {
  test('name と fields: true を送ると、その名前でプロジェクトを作って自分をオーナーにし、項目「みだし」「メモ」を作って、200 で返す', { tag: ['@TC-AP-PROJ-ADD1', '@TC-AP-PROJ-ADD2', '@TC-AP-PROJ-ADD4', '@TC-AP-PROJ-ADD6'] }, async ({ owner, requestAs, tag }) => {
    const request = await requestAs(owner)
    const response = await request.post('/api/projects', { data: { name: `作成${tag}`, fields: true } })
    await expectStatus(response, 200)
    const created = await response.json() as { id: number, name: string }
    expect(created.name).toBe(`作成${tag}`)

    const project = await (await request.get(`/api/projects/${created.id}`)).json() as { fields: { name: string }[], users: { role: string }[] }
    expect(project.fields.map(({ name }) => name)).toEqual(['みだし', 'メモ'])
    expect(project.users).toEqual([{ role: 'owner' }])
  })

  test('name と fields が無いと、名前を「無題のプロジェクト」にし、項目を作らない', { tag: ['@TC-AP-PROJ-ADD3', '@TC-AP-PROJ-ADD5'] }, async ({ owner, requestAs }) => {
    const request = await requestAs(owner)
    const response = await request.post('/api/projects')
    await expectStatus(response, 200)
    const created = await response.json() as { id: number, name: string }
    expect(created.name).toBe('無題のプロジェクト')

    const project = await (await request.get(`/api/projects/${created.id}`)).json() as { fields: unknown[] }
    expect(project.fields).toEqual([])
  })

  test('本文が入力の形に合わないと 400 を返す', { tag: ['@TC-AP-PROJ-ADD7'] }, async ({ owner, requestAs }) => {
    const request = await requestAs(owner)
    await expectStatus(await request.post('/api/projects', { data: { name: 1 } }), 400)
    await expectStatus(await request.post('/api/projects', { data: { fields: 'yes' } }), 400)
  })
})

test.describe('GET /api/projects/{projectId}（プロジェクトの取得）', () => {
  test('200 で、プロジェクトに項目（並び順）・カードの ID の一覧・自分のロールを付けて返す', { tag: ['@TC-AP-PROJ-GET1', '@TC-AP-PROJ-GET2'] }, async ({ owner, ownerApi, project, requestAs }) => {
    const [midashi, memo] = await ownerApi.fields(project.id)
    await ownerApi.call('put', `/api/projects/${project.id}/fields`, [{ id: midashi.id, order: 2 }, { id: memo.id, order: 1 }])
    await ownerApi.addCard(project.id)
    await ownerApi.addCard(project.id)

    const response = await (await requestAs(owner)).get(`/api/projects/${project.id}`)
    await expectStatus(response, 200)
    const body = await response.json() as { id: number, name: string, fields: { name: string }[], cards: { id: number }[], users: { role: string }[] }
    expect(body).toMatchObject({ id: project.id, name: project.name })
    expect(body.fields.map(({ name }) => name)).toEqual(['メモ', 'みだし'])
    expect(body.cards.map(({ id }) => id).sort()).toEqual([1, 2])
    expect(body.users).toEqual([{ role: 'owner' }])
  })
})

test.describe('PUT /api/projects/{projectId}（プロジェクトの名前の変更）', () => {
  test('名前を name にし、最終更新日時を更新して、200 で変えたプロジェクトを返す', { tag: ['@TC-AP-PROJ-NAME1', '@TC-AP-PROJ-NAME2', '@TC-AP-PROJ-NAME3'] }, async ({ owner, project, requestAs, tag }) => {
    const request = await requestAs(owner)

    await expectTouches(request, project.id, async () => {
      const response = await request.put(`/api/projects/${project.id}`, { data: { name: `変更後${tag}` } })
      await expectStatus(response, 200)
      expect(await response.json()).toMatchObject({ id: project.id, name: `変更後${tag}` })
    })
    expect(await (await request.get(`/api/projects/${project.id}`)).json()).toMatchObject({ name: `変更後${tag}` })
  })

  test('本文が入力の形に合わないと 400 を返す', { tag: ['@TC-AP-PROJ-NAME4'] }, async ({ owner, project, requestAs }) => {
    const request = await requestAs(owner)
    await expectStatus(await request.put(`/api/projects/${project.id}`, { data: {} }), 400)
    await expectStatus(await request.put(`/api/projects/${project.id}`, { data: { name: 1 } }), 400)
  })
})

test.describe('DELETE /api/projects/{projectId}（プロジェクトの削除）', () => {
  test('プロジェクトをカード・項目・値・画像とともに削除し、画像のファイルと縮小した画像のファイルを消して、204 を返す', { tag: ['@TC-AP-PROJ-DEL1', '@TC-AP-PROJ-DEL2', '@TC-AP-PROJ-DEL3'] }, async ({ owner, ownerApi, project, requestAs }) => {
    const request = await requestAs(owner)
    const card = await ownerApi.addCard(project.id, { みだし: '値' })
    const image = await (await request.post(`/api/projects/${project.id}/cards/${card.id}/images`, { multipart: { image: imagePart() } })).json() as { filename: string }
    // 縮小した画像は初めて表示するときに作る
    await expectStatus(await request.get(`/uploads/thumbs/${image.filename}.webp`), 200)

    await expectStatus(await request.delete(`/api/projects/${project.id}`), 204)

    expect((await (await request.get('/api/projects')).json() as { id: number }[]).map(({ id }) => id)).not.toContain(project.id)
    expect(existsSync(join(UPLOADS, 'public/images', image.filename))).toBe(false)
    expect(existsSync(join(UPLOADS, 'public/thumbs', `${image.filename}.webp`))).toBe(false)
  })
})

test.describe('GET /api/projects/{projectId}/export（エクスポート）', () => {
  test('プロジェクトに取り込み待ち・取り込み中のインポートがあると 409 を返す', { tag: ['@TC-AP-PROJ-EXP3'] }, async ({ owner, project, requestAs }) => {
    const request = await requestAs(owner)
    await whileImporting(request, project.id, async () => {
      await expectStatus(await request.get(`/api/projects/${project.id}/export`), 409)
    })
  })
})
