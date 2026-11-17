import { expect, test } from '../../fixtures'
import { expectStatus } from '../../support/apiSpec'

// API: その他（docs/product-spec/api/system.md）。認証（/api/auth/）は画面のテストで確かめる

type Layout = { id: number, areas: { id: number }[] }

test.describe('GET /api/health（稼働の確認）', () => {
  test('200 で ok を返す', { tag: ['@TC-AP-SYS-HLTH1'] }, async ({ requestAs }) => {
    const response = await (await requestAs('guest')).get('/api/health')
    await expectStatus(response, 200)
    expect(await response.text()).toBe('ok')
  })
})

test.describe('GET /api/print_layouts（印刷のレイアウトの一覧）', () => {
  test('200 で、カード印刷ビューのレイアウトの定義をすべて返す', { tag: ['@TC-AP-SYS-LAYS1', '@TC-AP-SYS-LAYS2'] }, async ({ owner, requestAs }) => {
    const response = await (await requestAs(owner)).get('/api/print_layouts')
    await expectStatus(response, 200)
    const layouts = await response.json() as Layout[]
    // レイアウトの数と中身はサーバーの定数（server/utils/printViewLayouts.ts）なので、形と ID が重ならないことを確かめる
    expect(layouts.length).toBeGreaterThan(0)
    for (const layout of layouts) expect(layout.areas.length).toBeGreaterThan(0)
    expect(new Set(layouts.map(({ id }) => id)).size).toBe(layouts.length)
  })
})

test.describe('GET /api/print_layouts/{layoutId}（印刷のレイアウトの取得）', () => {
  test('200 で、layoutId のレイアウトの定義を返す', { tag: ['@TC-AP-SYS-LAY1', '@TC-AP-SYS-LAY2'] }, async ({ owner, requestAs }) => {
    const request = await requestAs(owner)
    const layouts = await (await request.get('/api/print_layouts')).json() as Layout[]

    for (const layout of layouts) {
      const response = await request.get(`/api/print_layouts/${layout.id}`)
      await expectStatus(response, 200)
      expect(await response.json()).toEqual(layout)
    }
  })

  test('layoutId のレイアウトが無いと 404 を返す', { tag: ['@TC-AP-SYS-LAY3'] }, async ({ owner, requestAs }) => {
    await expectStatus(await (await requestAs(owner)).get('/api/print_layouts/999'), 404)
  })
})
