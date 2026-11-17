import { readFileSync } from 'node:fs'
import type { APIRequestContext } from '@playwright/test'
import { expect, test } from '../../fixtures'
import type { ProductApi, Project } from '../../support/api'
import type { Account } from '../../support/db'

// ロールと権限のうち、画面を通さない要求へのサーバーの応答（API E2E）。画面での権限は roles.spec.ts で確かめる

const IMAGE = readFileSync(new URL('../../files/table/image.png', import.meta.url))
const imageFile = { image: { name: 'image.png', mimeType: 'image/png', buffer: IMAGE } }

/** 送る要求（APIRequestContext.fetch の引数） */
type Request = { method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string } & Pick<NonNullable<Parameters<APIRequestContext['fetch']>[1]>, 'data' | 'multipart'>

/** 要求のテスト（権限の確認）に使う、オーナーのプロジェクトの中身 */
type Fixture = {
  project: Project
  cardId: number
  fieldId: number
  imageId: number
  imageFilename: string
}

/** オーナーのプロジェクトに、値と画像を持つカードを 1 枚作る */
async function prepareProject(ownerApi: ProductApi, owner: APIRequestContext, project: Project): Promise<Fixture> {
  const card = await ownerApi.addCard(project.id, { みだし: '元の値' })
  const fields = await ownerApi.fields(project.id)
  const uploaded = await owner.post(`/api/projects/${project.id}/cards/${card.id}/images`, { multipart: imageFile })
  expect(uploaded.status(), await uploaded.text()).toBe(200)
  const image = await uploaded.json() as { id: number, filename: string }
  return { project, cardId: card.id, fieldId: fields[0].id, imageId: image.id, imageFilename: image.filename }
}

/**
 * プロジェクト（/api/projects/:id 以下）の API のすべて（パスとメソッドの組）
 * インポート履歴の更新（PUT …/imports/:importId）は、インポートを作ると毎分の取り込みでデータが変わるため、作らずに ID 1 で送る
 * userId は、自分への招待の承認・拒否にならないよう、オーナーの ID を使う
 */
function projectRequests(f: Fixture, ownerId: string): Request[] {
  const base = `/api/projects/${f.project.id}`
  const card = `${base}/cards/${f.cardId}`
  const csv = { name: 'import.csv', mimeType: 'text/csv', buffer: Buffer.from('﻿ID,みだし\n1,書き換え\n') }
  return [
    { method: 'GET', path: base },
    { method: 'PUT', path: base, data: { name: '書き換え' } },
    { method: 'DELETE', path: base },
    { method: 'GET', path: `${base}/cards` },
    { method: 'POST', path: `${base}/cards`, data: {} },
    { method: 'PUT', path: `${base}/cards`, data: [{ id: f.cardId, order: 9 }] },
    { method: 'DELETE', path: `${base}/cards`, data: { ids: [f.cardId] } },
    { method: 'POST', path: `${base}/cards/duplicate`, data: { cardId: [f.cardId], toProjectId: f.project.id } },
    { method: 'GET', path: card },
    { method: 'DELETE', path: card },
    { method: 'PUT', path: `${card}/fields/${f.fieldId}`, data: { body: '書き換え' } },
    { method: 'POST', path: `${card}/images`, multipart: imageFile },
    { method: 'DELETE', path: `${card}/images/${f.imageId}` },
    { method: 'GET', path: `${base}/export` },
    { method: 'POST', path: `${base}/fields`, data: { name: '足した項目' } },
    { method: 'PUT', path: `${base}/fields`, data: [{ id: f.fieldId, order: 9 }] },
    { method: 'PUT', path: `${base}/fields/${f.fieldId}`, data: { name: '書き換え' } },
    { method: 'DELETE', path: `${base}/fields/${f.fieldId}` },
    { method: 'GET', path: `${base}/imports` },
    { method: 'POST', path: `${base}/imports`, multipart: { update: 'true', file: csv } },
    { method: 'PUT', path: `${base}/imports/1`, data: { notified: true } },
    { method: 'GET', path: `${base}/users` },
    { method: 'POST', path: `${base}/users`, data: { username: 'nobody', status: 'invited' } },
    { method: 'PUT', path: `${base}/users/${ownerId}`, data: { status: null } },
    { method: 'DELETE', path: `${base}/users/${ownerId}` },
  ]
}

/** 画像・縮小画像の URL */
function imageRequests(f: Fixture): Request[] {
  return [
    { method: 'GET', path: `/uploads/images/${f.imageFilename}` },
    { method: 'GET', path: `/uploads/thumbs/${f.imageFilename}.webp` },
  ]
}

/** 要求をすべて送り、要求ごとの状態コードを返す（失敗したときに、どの要求かが分かるように） */
async function statuses(context: APIRequestContext, requests: Request[]) {
  const result: Record<string, number> = {}
  for (const { method, path, data, multipart } of requests) {
    const response = await context.fetch(path, { method, data, multipart, maxRedirects: 0 })
    result[`${method} ${path}`] = response.status()
  }
  return result
}

function expectAll(result: Record<string, number>, status: number) {
  expect(result).toEqual(Object.fromEntries(Object.keys(result).map((key) => [key, status])))
}

/** オーナーで GET し、JSON を返す */
async function read<T = unknown>(owner: APIRequestContext, path: string): Promise<T> {
  const response = await owner.get(path)
  expect(response.status(), `${path} ${await response.text()}`).toBe(200)
  return await response.json() as T
}

/** オーナーから見たプロジェクトの中身（要求の後に変わっていないことを確かめる） */
async function snapshot(owner: APIRequestContext, projectId: number) {
  const base = `/api/projects/${projectId}`
  return {
    project: await read(owner, base),
    cards: await read(owner, `${base}/cards`),
    users: await read(owner, `${base}/users`),
    imports: await read(owner, `${base}/imports`),
  }
}

/** メンバーの一覧（ユーザーIDと権限・招待の状態） */
async function members(context: APIRequestContext, projectId: number) {
  const users = await read<{ username: string, role: string | null, status: string | null }[]>(context, `/api/projects/${projectId}/users`)
  return users.map(({ username, role, status }) => ({ username, role, status }))
}

/** オーナーのプロジェクトに招待し、承認させて編集者にする */
async function makeEditor(ownerApi: ProductApi, project: Project, editor: Account, editorApi: ProductApi) {
  await ownerApi.invite(project.id, editor.username!)
  await editorApi.accept(project.id, editor.id)
}

/** エラーの応答の本文から、要求した URL を除く（権限が無い場合と対象が無い場合を比べるため） */
function withoutUrl(body: Record<string, unknown>) {
  const { url: _url, ...rest } = body
  return rest
}

test.describe('サーバーでの権限の確認', () => {
  test('受け付けない要求は、ログインしていなければ 401、メンバーでなければ、プロジェクトが無い場合と同じ 404 を返す', { tag: ['@TC-FT-ROLES-SRV1'] }, async ({ project, newAccount, requestAs }) => {
    const stranger = await requestAs(await newAccount({ suffix: 'stranger' }))
    const path = (id: number) => `/api/projects/${id}/cards`

    expect((await (await requestAs('guest')).get(path(project.id))).status()).toBe(401)
    const forbidden = await stranger.get(path(project.id))
    const missing = await stranger.get(path(project.id + 1_000_000))
    expect(forbidden.status()).toBe(404)
    expect(missing.status()).toBe(404)
    // 状態コードだけでなく本文でも、権限が無いことと対象が無いことを見分けられない
    expect(withoutUrl(await forbidden.json())).toEqual(withoutUrl(await missing.json()))
  })

  test('権限はそのプロジェクトでのロールで決まり、別のプロジェクトのオーナーでも、編集者のプロジェクトではオーナーだけの操作を受け付けない', { tag: ['@TC-FT-ROLES-SRV2'] }, async ({ ownerApi, owner, project, newAccount, apiAs, requestAs }) => {
    const user = await newAccount({ suffix: 'both' })
    const userApi = await apiAs(user)
    const own = await userApi.createProject('自分のプロジェクト')
    await makeEditor(ownerApi, project, user, userApi)
    const invitee = await newAccount({ suffix: 'invitee' })
    const context = await requestAs(user)
    const invite = { data: { username: invitee.username, status: 'invited' } }

    // 自分がオーナーのプロジェクトでは受け付ける
    expect((await context.post(`/api/projects/${own.id}/users`, invite)).status()).toBe(204)
    // 編集者のプロジェクトでは受け付けない
    expect((await context.post(`/api/projects/${project.id}/users`, invite)).status()).toBe(404)
    expect((await context.delete(`/api/projects/${project.id}`)).status()).toBe(404)
    expect(await members(await requestAs(owner), project.id)).not.toContainEqual(expect.objectContaining({ username: invitee.username }))
    expect((await ownerApi.call<Project>('get', `/api/projects/${project.id}`)).name).toBe(project.name)
  })

  test('ログインせずに送ったプロジェクトの要求は、すべて受け付けない（401）', { tag: ['@TC-FT-ROLES-SRV3'] }, async ({ owner, ownerApi, project, requestAs }) => {
    const ownerContext = await requestAs(owner)
    const f = await prepareProject(ownerApi, ownerContext, project)
    const before = await snapshot(ownerContext, project.id)

    const result = await statuses(await requestAs('guest'), [
      { method: 'GET', path: '/api/projects' },
      { method: 'POST', path: '/api/projects', data: { name: 'ゲストのプロジェクト' } },
      ...projectRequests(f, owner.id),
    ])

    expectAll(result, 401)
    expect(await snapshot(ownerContext, project.id)).toEqual(before)
  })

  test('ログインせずに画像・縮小画像を要求すると、画像を返さずにログイン画面へ転送する', { tag: ['@TC-FT-ROLES-SRV4'] }, async ({ owner, ownerApi, project, requestAs }) => {
    const ownerContext = await requestAs(owner)
    const f = await prepareProject(ownerApi, ownerContext, project)
    const guest = await requestAs('guest')

    for (const { path } of imageRequests(f)) {
      const response = await guest.get(path, { maxRedirects: 0 })
      expect(response.status(), path).toBe(302)
      expect(response.headers().location, path).toBe('/login')
    }
    // オーナーは取得できる
    expectAll(await statuses(ownerContext, imageRequests(f)), 200)
  })

  test('メンバーでないプロジェクトの要求は、すべて受け付けず（404）、データを変えない', { tag: ['@TC-FT-ROLES-SRV5'] }, async ({ owner, ownerApi, project, newAccount, requestAs }) => {
    const ownerContext = await requestAs(owner)
    const f = await prepareProject(ownerApi, ownerContext, project)
    const before = await snapshot(ownerContext, project.id)

    const result = await statuses(await requestAs(await newAccount({ suffix: 'stranger' })), projectRequests(f, owner.id))

    expectAll(result, 404)
    expect(await snapshot(ownerContext, project.id)).toEqual(before)
  })

  test('招待中のユーザーも、承認するまではメンバーでないものとして、自分への招待の承認・拒否のほかは受け付けない（404）', { tag: ['@TC-FT-ROLES-SRV6'] }, async ({ owner, ownerApi, project, newAccount, requestAs }) => {
    const ownerContext = await requestAs(owner)
    const f = await prepareProject(ownerApi, ownerContext, project)
    const invited = await newAccount({ suffix: 'invited' })
    await ownerApi.invite(project.id, invited.username!)
    const before = await snapshot(ownerContext, project.id)

    const result = await statuses(await requestAs(invited), projectRequests(f, owner.id))

    expectAll(result, 404)
    expect(await snapshot(ownerContext, project.id)).toEqual(before)
  })

  test('メンバーでないプロジェクトの画像・縮小画像を要求すると、受け付けない（404）', { tag: ['@TC-FT-ROLES-SRV7'] }, async ({ owner, ownerApi, project, newAccount, requestAs }) => {
    const f = await prepareProject(ownerApi, await requestAs(owner), project)

    expectAll(await statuses(await requestAs(await newAccount({ suffix: 'stranger' })), imageRequests(f)), 404)
  })

  test('招待中のユーザーは、自分への招待を承認・拒否でき、承認するとプロジェクトの要求を受け付け、拒否すると受け付けないままになる', { tag: ['@TC-FT-ROLES-SRV8'] }, async ({ owner, ownerApi, project, newAccount, requestAs }) => {
    const accepting = await newAccount({ suffix: 'accepting' })
    const declining = await newAccount({ suffix: 'declining' })
    await ownerApi.invite(project.id, accepting.username!)
    await ownerApi.invite(project.id, declining.username!)
    const acceptingContext = await requestAs(accepting)
    const decliningContext = await requestAs(declining)
    const cards = `/api/projects/${project.id}/cards`

    expect((await acceptingContext.put(`/api/projects/${project.id}/users/${accepting.id}`, { data: { status: null } })).status()).toBe(204)
    expect((await acceptingContext.get(cards)).status()).toBe(200)

    expect((await decliningContext.delete(`/api/projects/${project.id}/users/${declining.id}`)).status()).toBe(204)
    expect((await decliningContext.get(cards)).status()).toBe(404)

    expect(await members(await requestAs(owner), project.id)).toEqual([
      { username: owner.username, role: 'owner', status: null },
      { username: accepting.username, role: null, status: null },
    ])
  })

  test('他のユーザーへの招待を承認しようとすると、オーナーでも招待中の別のユーザーでも受け付けない（404）', { tag: ['@TC-FT-ROLES-SRV9'] }, async ({ owner, ownerApi, project, newAccount, requestAs }) => {
    const invited = await newAccount({ suffix: 'invited' })
    const other = await newAccount({ suffix: 'other' })
    await ownerApi.invite(project.id, invited.username!)
    await ownerApi.invite(project.id, other.username!)
    const ownerContext = await requestAs(owner)
    const accept = async (context: APIRequestContext) => (await context.put(`/api/projects/${project.id}/users/${invited.id}`, { data: { status: null } })).status()

    expect(await accept(ownerContext)).toBe(404)
    expect(await accept(await requestAs(other))).toBe(404)
    expect(await members(ownerContext, project.id)).toContainEqual({ username: invited.username, role: null, status: 'invited' })
  })

  test.describe('編集者がオーナーだけの操作を要求すると、受け付けない（404）', () => {
    test('ユーザーの招待', { tag: ['@TC-FT-ROLES-SRV11'] }, async ({ owner, ownerApi, project, newAccount, apiAs, requestAs }) => {
      const editor = await newAccount({ suffix: 'editor' })
      await makeEditor(ownerApi, project, editor, await apiAs(editor))
      const invitee = await newAccount({ suffix: 'invitee' })

      const response = await (await requestAs(editor)).post(`/api/projects/${project.id}/users`, { data: { username: invitee.username, status: 'invited' } })

      expect(response.status()).toBe(404)
      expect(await members(await requestAs(owner), project.id)).not.toContainEqual(expect.objectContaining({ username: invitee.username }))
    })

    test('ユーザーの削除（別の編集者・招待中のユーザー）', { tag: ['@TC-FT-ROLES-SRV12'] }, async ({ owner, ownerApi, project, newAccount, apiAs, requestAs }) => {
      const editor = await newAccount({ suffix: 'editor' })
      await makeEditor(ownerApi, project, editor, await apiAs(editor))
      const another = await newAccount({ suffix: 'another' })
      await makeEditor(ownerApi, project, another, await apiAs(another))
      const invited = await newAccount({ suffix: 'invited' })
      await ownerApi.invite(project.id, invited.username!)
      const ownerContext = await requestAs(owner)
      const before = await members(ownerContext, project.id)

      const result = await statuses(await requestAs(editor), [
        { method: 'DELETE', path: `/api/projects/${project.id}/users/${another.id}` },
        { method: 'DELETE', path: `/api/projects/${project.id}/users/${invited.id}` },
      ])

      expectAll(result, 404)
      expect(await members(ownerContext, project.id)).toEqual(before)
    })

    test('プロジェクトの削除', { tag: ['@TC-FT-ROLES-SRV13'] }, async ({ ownerApi, project, newAccount, apiAs, requestAs }) => {
      const editor = await newAccount({ suffix: 'editor' })
      await makeEditor(ownerApi, project, editor, await apiAs(editor))

      expect((await (await requestAs(editor)).delete(`/api/projects/${project.id}`)).status()).toBe(404)
      expect((await ownerApi.call<Project>('get', `/api/projects/${project.id}`)).name).toBe(project.name)
    })
  })

  test('オーナーをプロジェクトから外す要求は、オーナー自身からも編集者からも受け付けない（404）', { tag: ['@TC-FT-ROLES-SRV14'] }, async ({ owner, ownerApi, project, newAccount, apiAs, requestAs }) => {
    const editor = await newAccount({ suffix: 'editor' })
    await makeEditor(ownerApi, project, editor, await apiAs(editor))
    const ownerContext = await requestAs(owner)
    const removeOwner = `/api/projects/${project.id}/users/${owner.id}`

    expect((await ownerContext.delete(removeOwner)).status()).toBe(404)
    expect((await (await requestAs(editor)).delete(removeOwner)).status()).toBe(404)
    expect(await members(ownerContext, project.id)).toContainEqual({ username: owner.username, role: 'owner', status: null })
  })

  test('編集者が自分をプロジェクトから外す要求は、受け付けない（404）', { tag: ['@TC-FT-ROLES-SRV15'] }, async ({ ownerApi, project, newAccount, apiAs, requestAs }) => {
    const editor = await newAccount({ suffix: 'editor' })
    await makeEditor(ownerApi, project, editor, await apiAs(editor))
    const context = await requestAs(editor)

    expect((await context.delete(`/api/projects/${project.id}/users/${editor.id}`)).status()).toBe(404)
    // メンバーのまま
    expect((await context.get(`/api/projects/${project.id}/cards`)).status()).toBe(200)
  })

  test('編集者が要求したメンバーの一覧には、招待中のユーザーを含めない（オーナーの一覧には含める）', { tag: ['@TC-FT-ROLES-SRV16'] }, async ({ owner, ownerApi, project, newAccount, apiAs, requestAs }) => {
    const editor = await newAccount({ suffix: 'editor' })
    await makeEditor(ownerApi, project, editor, await apiAs(editor))
    const invited = await newAccount({ suffix: 'invited' })
    await ownerApi.invite(project.id, invited.username!)

    expect(await members(await requestAs(editor), project.id)).toEqual([
      { username: owner.username, role: 'owner', status: null },
      { username: editor.username, role: null, status: null },
    ])
    expect(await members(await requestAs(owner), project.id)).toEqual([
      { username: owner.username, role: 'owner', status: null },
      { username: editor.username, role: null, status: null },
      { username: invited.username, role: null, status: 'invited' },
    ])
  })
})
