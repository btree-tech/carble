import type { APIRequestContext } from '@playwright/test'
import { expect, test } from '../../fixtures'
import { expectStatus, whileImporting } from '../../support/apiSpec'

// API: メンバー（docs/product-spec/api/members.md）。受け付けない要求（権限）は specs/features/roles.api.spec.ts

type Member = { id: string, name: string, username: string | null, role: string | null, status: string | null }

const usersPath = (projectId: number) => `/api/projects/${projectId}/users`

async function members(request: APIRequestContext, projectId: number) {
  const response = await request.get(usersPath(projectId))
  await expectStatus(response, 200)
  return await response.json() as Member[]
}

async function projectIds(request: APIRequestContext, params: Record<string, string> = {}) {
  return (await (await request.get('/api/projects', { params })).json() as { id: number }[]).map(({ id }) => id)
}

test.describe('GET /api/projects/{projectId}/users（メンバーの一覧）', () => {
  test('200 で、メンバーをプロジェクトに加わった順に返し、ユーザーの ID・ユーザーID・名前・ロール・招待の状態を付け、オーナーには招待中のユーザーも含める', { tag: ['@TC-AP-MEMBER-LIST1', '@TC-AP-MEMBER-LIST2', '@TC-AP-MEMBER-LIST3'] }, async ({ owner, ownerApi, project, newAccount, requestAs, apiAs }) => {
    const editor = await newAccount({ suffix: 'editor' })
    await ownerApi.invite(project.id, editor.username!)
    // 招待の承認は、招待されたユーザー本人が送る
    await (await apiAs(editor)).accept(project.id, editor.id)
    const invitee = await newAccount({ suffix: 'invitee' })
    await ownerApi.invite(project.id, invitee.username!)

    expect(await members(await requestAs(owner), project.id)).toEqual([
      { id: owner.id, name: owner.name, username: owner.username, role: 'owner', status: null },
      { id: editor.id, name: editor.name, username: editor.username, role: null, status: null },
      { id: invitee.id, name: invitee.name, username: invitee.username, role: null, status: 'invited' },
    ])
  })
})

test.describe('POST /api/projects/{projectId}/users（ユーザーの招待）', () => {
  test('username のユーザーを招待中のユーザーとして加え、204 を返す', { tag: ['@TC-AP-MEMBER-INV1', '@TC-AP-MEMBER-INV2'] }, async ({ owner, project, newAccount, requestAs }) => {
    const invitee = await newAccount({ suffix: 'invitee' })

    await expectStatus(await (await requestAs(owner)).post(usersPath(project.id), { data: { username: invitee.username, status: 'invited' } }), 204)

    expect(await projectIds(await requestAs(invitee), { status: 'invited' })).toEqual([project.id])
    expect((await members(await requestAs(owner), project.id)).find(({ id }) => id === invitee.id)).toMatchObject({ role: null, status: 'invited' })
  })

  test('本文が入力の形に合わない・username のユーザーがいないと 400 を返す', { tag: ['@TC-AP-MEMBER-INV3', '@TC-AP-MEMBER-INV4'] }, async ({ owner, project, newAccount, requestAs, tag }) => {
    const request = await requestAs(owner)
    const invitee = await newAccount({ suffix: 'invitee' })

    await expectStatus(await request.post(usersPath(project.id), { data: { username: invitee.username } }), 400)
    await expectStatus(await request.post(usersPath(project.id), { data: { username: `${tag}nobody`, status: 'invited' } }), 400)
    expect((await members(request, project.id)).map(({ id }) => id)).toEqual([owner.id])
  })
})

test.describe('PUT /api/projects/{projectId}/users/{userId}（招待の承認）', () => {
  test('招待を承認してプロジェクトの編集者にし、204 を返す', { tag: ['@TC-AP-MEMBER-ACPT1', '@TC-AP-MEMBER-ACPT2'] }, async ({ owner, ownerApi, project, newAccount, requestAs }) => {
    const invitee = await newAccount({ suffix: 'invitee' })
    await ownerApi.invite(project.id, invitee.username!)
    const request = await requestAs(invitee)

    await expectStatus(await request.put(`${usersPath(project.id)}/${invitee.id}`, { data: { status: null } }), 204)

    expect(await projectIds(request)).toEqual([project.id])
    expect(await projectIds(request, { status: 'invited' })).toEqual([])
    expect((await members(await requestAs(owner), project.id)).find(({ id }) => id === invitee.id)).toMatchObject({ role: null, status: null })
  })

  test('本文が入力の形に合わないと 400 を返す', { tag: ['@TC-AP-MEMBER-ACPT3'] }, async ({ ownerApi, project, newAccount, requestAs }) => {
    const invitee = await newAccount({ suffix: 'invitee' })
    await ownerApi.invite(project.id, invitee.username!)
    const request = await requestAs(invitee)

    await expectStatus(await request.put(`${usersPath(project.id)}/${invitee.id}`, { data: { status: 'invited' } }), 400)
    expect(await projectIds(request, { status: 'invited' })).toEqual([project.id])
  })
})

test.describe('DELETE /api/projects/{projectId}/users/{userId}（メンバーを外す・招待の取り消し・招待の拒否）', () => {
  test('自分がオーナーで userId が編集者なら、そのユーザーをプロジェクトから外し、204 を返す', { tag: ['@TC-AP-MEMBER-DEL1', '@TC-AP-MEMBER-DEL4'] }, async ({ owner, ownerApi, project, newAccount, requestAs, apiAs }) => {
    const editor = await newAccount({ suffix: 'editor' })
    await ownerApi.invite(project.id, editor.username!)
    await (await apiAs(editor)).accept(project.id, editor.id)

    await expectStatus(await (await requestAs(owner)).delete(`${usersPath(project.id)}/${editor.id}`), 204)

    expect(await projectIds(await requestAs(editor))).toEqual([])
    expect((await members(await requestAs(owner), project.id)).map(({ id }) => id)).toEqual([owner.id])
  })

  test('自分がオーナーで userId が招待中のユーザーなら、招待を取り消す', { tag: ['@TC-AP-MEMBER-DEL2', '@TC-AP-MEMBER-DEL4'] }, async ({ owner, ownerApi, project, newAccount, requestAs }) => {
    const invitee = await newAccount({ suffix: 'invitee' })
    await ownerApi.invite(project.id, invitee.username!)

    await expectStatus(await (await requestAs(owner)).delete(`${usersPath(project.id)}/${invitee.id}`), 204)

    expect(await projectIds(await requestAs(invitee), { status: 'invited' })).toEqual([])
    expect((await members(await requestAs(owner), project.id)).map(({ id }) => id)).toEqual([owner.id])
  })

  test('userId が自分で、自分が招待中なら、招待を拒否する', { tag: ['@TC-AP-MEMBER-DEL3', '@TC-AP-MEMBER-DEL4'] }, async ({ owner, ownerApi, project, newAccount, requestAs }) => {
    const invitee = await newAccount({ suffix: 'invitee' })
    await ownerApi.invite(project.id, invitee.username!)
    const request = await requestAs(invitee)

    await expectStatus(await request.delete(`${usersPath(project.id)}/${invitee.id}`), 204)

    expect(await projectIds(request, { status: 'invited' })).toEqual([])
    expect((await members(await requestAs(owner), project.id)).map(({ id }) => id)).toEqual([owner.id])
  })
})

test('取り込み待ち・取り込み中のインポートがあると、メンバーの API は 409 を返す', { tag: ['@TC-AP-MEMBER-LIST4', '@TC-AP-MEMBER-INV5', '@TC-AP-MEMBER-ACPT4', '@TC-AP-MEMBER-DEL5'] }, async ({ owner, ownerApi, project, newAccount, requestAs }) => {
  const request = await requestAs(owner)
  const invitee = await newAccount({ suffix: 'invitee' })
  await ownerApi.invite(project.id, invitee.username!)
  const another = await newAccount({ suffix: 'another' })
  const inviteeRequest = await requestAs(invitee)

  await whileImporting(request, project.id, async () => {
    await expectStatus(await request.get(usersPath(project.id)), 409)
    await expectStatus(await request.post(usersPath(project.id), { data: { username: another.username, status: 'invited' } }), 409)
    await expectStatus(await inviteeRequest.put(`${usersPath(project.id)}/${invitee.id}`, { data: { status: null } }), 409)
    await expectStatus(await request.delete(`${usersPath(project.id)}/${invitee.id}`), 409)
  })
})
