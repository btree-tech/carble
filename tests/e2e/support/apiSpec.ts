import { readFileSync } from 'node:fs'
import { expect, type APIRequestContext, type APIResponse } from '@playwright/test'

/**
 * API の仕様（docs/product-spec/api/）のテスト（specs/api/*.api.spec.ts）で使う道具
 */

/** 画像・インポートのファイルの保存先（runner と app で共有するボリューム。読むだけにする） */
export const UPLOADS = process.env.UPLOADS_PATH!

export const testFile = (path: string) => readFileSync(new URL(`../files/${path}`, import.meta.url))

export const imagePart = (path = 'table/image.png') => ({ name: 'image.png', mimeType: 'image/png', buffer: testFile(path) })

/** 状態コードを確かめる（違ったら本文も出す） */
export async function expectStatus(response: APIResponse, status: number) {
  expect(response.status(), `${response.url()}: ${await response.text()}`).toBe(status)
}

async function updatedAt(request: APIRequestContext, projectId: number) {
  const project = await (await request.get(`/api/projects/${projectId}`)).json() as { updatedAt: string }
  return new Date(project.updatedAt).getTime()
}

/**
 * action がプロジェクトの最終更新日時を更新することを確かめる。
 * 最終更新日時は秒の単位なので、今の値より後の秒になってから action を送る
 */
export async function expectTouches(request: APIRequestContext, projectId: number, action: () => Promise<unknown>) {
  const before = await updatedAt(request, projectId)
  await expect.poll(() => Date.now(), { message: '最終更新日時の次の秒になるのを待つ' }).toBeGreaterThanOrEqual(before + 1000)
  await action()
  expect(await updatedAt(request, projectId)).toBeGreaterThan(before)
}

/** インポートを登録する（オーナーで呼ぶ）。テストが終わると fixture の newAccount が、取り込み待ちのまま残ったものを消す */
export async function registerImport(owner: APIRequestContext, projectId: number) {
  const response = await owner.post(`/api/projects/${projectId}/imports`, {
    multipart: { file: { name: 'cards.csv', mimeType: 'text/csv', buffer: testFile('settings/cards.csv') } },
  })
  await expectStatus(response, 200)
  return await response.json() as { id: number }
}

/**
 * プロジェクトに取り込み待ち・取り込み中のインポートがある間に check を流す。
 * 毎分の取り込みで、check の途中にインポートが終わったら（状態は戻らないので、終わりに確かめれば分かる）、登録し直してやり直す
 */
export async function whileImporting(owner: APIRequestContext, projectId: number, check: () => Promise<void>) {
  await expect(async () => {
    const registered = await registerImport(owner, projectId)
    await check()
    const pending = await (await owner.get(`/api/projects/${projectId}/imports`, { params: 'status=OPEN&status=IN_PROGRESS' })).json() as { items: { id: number }[] }
    expect(pending.items.map(({ id }) => id), 'check の間、インポートが取り込み待ち・取り込み中のままだった').toContain(registered.id)
  }).toPass({ timeout: 90_000 })
}
