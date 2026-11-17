import { randomInt } from 'node:crypto'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { addImageByApi } from '../pages/CardViewPage'
import type { ProductApi } from './api'
import type { Account } from './db'

const VISUAL_ID = /^@(TC-[A-Z]{2}-[A-Z][A-Z0-9]{1,8}-VRT[0-9]+)$/

/**
 * VRT。画面全体を撮り、正解の画像（tests/e2e/snapshots/<ID>.png）と比べる（docs/test-design/README.md の「見た目」）
 *
 *   test('…', { tag: ['@TC-PG-PLIST-VRT1'] }, async ({ ownerPage }) => { …; await expectScreen(ownerPage) })
 *
 * 画像の名前は、テストに付けた種別 VRT のタグの ID にする（1 つのテストに 1 つ）。
 * 実行ごとに変わる値（日時・ユーザーID など）は mask で塗る。
 * 親の要素で切り取られることのある要素（カード印刷ビューの QR コード）は、blackout に CSS のセレクターで渡し、黒く塗る
 */
export async function expectScreen(page: Page, options: { mask?: Locator[], blackout?: string[] } = {}) {
  const ids = test.info().tags.flatMap((tag) => tag.match(VISUAL_ID)?.[1] ?? [])
  if (ids.length !== 1) throw new Error(`VRT のテストには、種別 VRT のタグを 1 つだけ付ける（付いているのは ${ids.join('・') || '無し'}）`)

  // 文字と画像を描き終えてから撮る（toHaveScreenshot も、2 回続けて同じ画像になるまで撮り直す）
  await page.evaluate(() => document.fonts.ready)
  await expect.poll(() => page.evaluate(() => [...document.images].every((image) => image.complete))).toBe(true)
  // mask は、親の要素で切り取られて見えない部分も塗るので、切り取られる要素は CSS で黒く塗る
  if (options.blackout?.length) {
    await page.addStyleTag({ content: `${options.blackout.join(', ')} { filter: brightness(0) !important; }` })
  }
  await expect(page).toHaveScreenshot(`${ids[0]}.png`, { fullPage: true, mask: options.mask })
}

/**
 * VRT の画面に写るユーザーID。リポジトリ全体で重ならない値にする（fixtures の newAccount）。
 * 表の列の幅が文字の幅で変わらないよう、英字を固定し、変わる部分は数字だけにする
 */
export function visualUsername(suffix: string) {
  return `vrt${randomInt(1e9).toString().padStart(9, '0')}${suffix}`
}

/**
 * 次の秒まで待つ。最終更新日時は秒の単位で記録するので、最終更新日時の順に並ぶ画面は、作るたびに待って並びを決める
 */
export async function nextSecond() {
  const target = (Math.floor(Date.now() / 1000) + 1) * 1000
  await expect.poll(() => Date.now(), { intervals: [100] }).toBeGreaterThanOrEqual(target)
}

// ---------------------------------------------------------------------------
// 前提データ。画像に写る名前・値は、毎回同じ固定の値にする（fixtures の tag 入りの名前は使わない）

/** VRT の画面に写るユーザーの名前 */
export const VISUAL_NAMES = {
  owner: '研究者 一郎',
  editor: '研究者 二郎',
  invited: '研究者 三郎',
} as const

/** 見本のプロジェクトのカード（項目は初期の「みだし」「メモ」。画像は tests/e2e/files/card/ のファイル） */
const SAMPLE_CARDS = [
  { みだし: 'ナミアゲハ', メモ: '庭のミカンの木で幼虫を見つけた', image: 'red.png' },
  { みだし: 'モンシロチョウ', メモ: '畑のキャベツの葉の裏に卵があった', image: 'green.png' },
  { みだし: 'オオムラサキ', メモ: '雑木林のエノキの周りを飛んでいた', image: undefined },
]

/**
 * 見本のプロジェクト（カード 3 枚。1・2 枚目に画像）を作る。
 * page は、画像を送るログイン状態の画面（support/api.ts はファイルを送れない）
 */
export async function createSampleProject(api: ProductApi, page: Page, name = '昆虫の観察記録') {
  const project = await api.createProject(name)
  const cards = []
  for (const { image, ...values } of SAMPLE_CARDS) {
    const card = await api.addCard(project.id, values)
    if (image) await addImageByApi(page, project.id, card.id, image)
    cards.push(card)
  }
  return { project, cards }
}

/**
 * プロジェクト一覧の見本。me が、自分のプロジェクト・編集者として加わったプロジェクトのメンバーで、もう 1 つに招待されている。
 * 一覧は最終更新日時の順なので、作るたびに秒を変えて並びを決める
 */
export async function createProjectListScene(me: ProductApi, meId: string, meUsername: string, owner: ProductApi) {
  await me.createProject('植物標本の調査')
  await nextSecond()
  const shared = await owner.createProject('昆虫の観察記録')
  await owner.invite(shared.id, meUsername)
  await me.accept(shared.id, meId)
  const invited = await owner.createProject('鉱物のサンプル')
  await owner.invite(invited.id, meUsername)
}

/** プロジェクト設定の「ユーザー管理」の見本。オーナーのほかに、編集者と招待中のユーザーを加える（加えた順に並ぶ） */
export async function createSettingsUsersScene(
  owner: ProductApi,
  projectId: number,
  newAccount: (values: { suffix: string, username: string, name: string }) => Promise<Account>,
  apiAs: (account: Account) => Promise<ProductApi>,
) {
  const editor = await newAccount({ suffix: 'editor', username: visualUsername('editor'), name: VISUAL_NAMES.editor })
  await owner.invite(projectId, editor.username!)
  await (await apiAs(editor)).accept(projectId, editor.id)
  const invited = await newAccount({ suffix: 'invited', username: visualUsername('invited'), name: VISUAL_NAMES.invited })
  await owner.invite(projectId, invited.username!)
}
