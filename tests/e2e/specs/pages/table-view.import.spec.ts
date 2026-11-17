import { request } from '@playwright/test'
import { expect, test } from '../../fixtures'
import { TableViewPage } from '../../pages/TableViewPage'
import type { ProductApi } from '../../support/api'
import { SESSION_COOKIE, type Account } from '../../support/db'
import { IMPORT_TIMEOUT } from '../../support/imports'
import { spec } from '../../support/spec'

const SPEC = 'pages/table-view.md'

/**
 * インポートを始める（オーナーで呼ぶ。support/api.ts の ProductApi は JSON だけを送るので multipart はここで送る）
 */
async function startImport(account: Account, projectId: number, csv: string, options: { update?: boolean } = {}) {
  const context = await request.newContext({
    baseURL: process.env.BASE_URL,
    extraHTTPHeaders: { cookie: `${SESSION_COOKIE}=${account.sessionCookie}` },
  })
  try {
    const response = await context.post(`/api/projects/${projectId}/imports`, {
      multipart: {
        update: String(options.update ?? false),
        file: { name: 'import.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) },
      },
    })
    if (!response.ok()) throw new Error(`インポートを始められません: ${response.status()} ${await response.text()}`)
  } finally {
    await context.dispose()
  }
}

/** 最も新しいインポートが、毎分の定期タスクで取り込まれて status になるのを待つ */
async function waitForImport(api: ProductApi, projectId: number, status: 'DONE' | 'FORMAT_ERROR') {
  await expect.poll(async () => {
    const { items } = await api.call<{ items: { status: string }[] }>('get', `/api/projects/${projectId}/imports?pageCount=1`)
    return items[0]?.status
  }, { timeout: IMPORT_TIMEOUT, intervals: [5_000] }).toBe(status)
}

test('オーナーには、まだ知らせていないインポートのうち最も新しい 1 件の結果を表示して知らせたことにし、「詳細」でプロジェクト設定のインポートに遷移する', spec(SPEC,
  'ヘッダー > WHERE オーナーの場合、まだ知らせていないインポートのうち',
  'ヘッダー > WHERE オーナーの場合 > WHERE インポートが完了した場合',
  'ヘッダー > WHERE オーナーの場合 > WHERE インポートが失敗した場合',
  'ヘッダー > WHERE オーナーの場合 > どちらも「詳細」ボタンで',
  'カードの一覧 > カードを並び順の昇順に表示する > 並び順は',
), async ({ ownerPage, ownerApi, owner, project, newAccount, apiAs, pageAs }) => {
  const editor = await newAccount({ suffix: 'editor' })
  await ownerApi.invite(project.id, editor.username!)
  await (await apiAs(editor)).accept(project.id, editor.id)

  // 失敗するインポート（データの行が無い）の後に、完了するインポート（行の順は ID 3, 1, 2）
  await startImport(owner, project.id, 'title\n')
  await waitForImport(ownerApi, project.id, 'FORMAT_ERROR')
  await startImport(owner, project.id, 'ID,title\n3,c\n1,a\n2,b\n', { update: true })
  await waitForImport(ownerApi, project.id, 'DONE')

  // 編集者には表示しない（知らせたことにもしない）
  const editorView = new TableViewPage(await pageAs(editor))
  await editorView.open(project.id)
  await expect(editorView.idCells).toHaveText(['3', '1', '2'])
  await expect(editorView.importAlert('インポートが完了しました')).toHaveCount(0)
  await expect(editorView.importAlert('インポートに失敗しました')).toHaveCount(0)

  // オーナーには最も新しい 1 件（完了）を表示する。カードはインポートの行の順に並ぶ
  const tv = new TableViewPage(ownerPage)
  const notified = () => ownerPage.waitForResponse((r) => r.request().method() === 'PUT' && /\/imports\/\d+$/.test(r.url()))
  let put = notified()
  await tv.open(project.id)
  await expect(tv.importAlert('インポートが完了しました')).toBeVisible()
  await expect(tv.importAlert('インポートに失敗しました')).toHaveCount(0)
  await expect(tv.idCells).toHaveText(['3', '1', '2'])
  await expect(tv.orderCells).toHaveText(['1', '2', '3'])
  await put
  await tv.importAlertDetailLink.click()
  await expect(ownerPage).toHaveURL(`/projects/${project.id}/settings/import`)

  // 完了は知らせたので、次はまだ知らせていない失敗を表示する
  put = notified()
  await tv.open(project.id)
  await expect(tv.importAlert('インポートに失敗しました')).toBeVisible()
  await expect(tv.importAlert('インポートが完了しました')).toHaveCount(0)
  await put
  await tv.importAlertDetailLink.click()
  await expect(ownerPage).toHaveURL(`/projects/${project.id}/settings/import`)

  // すべて知らせたので、何も表示しない
  await tv.open(project.id)
  await expect(tv.idCells).toHaveText(['3', '1', '2'])
  await expect(tv.importAlert('インポートが完了しました')).toHaveCount(0)
  await expect(tv.importAlert('インポートに失敗しました')).toHaveCount(0)
})
