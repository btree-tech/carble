import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '../../fixtures'
import { addImage, fileOf, MIME, ProjectScreen, ProjectSettingsPage, uploadImport } from '../../pages/ProjectSettingsPage'

// 保存したファイルの置き場所は画面に出ないので、app と共有のボリュームを見る（読むだけ）
const uploaded = (...path: string[]) => existsSync(join(process.env.UPLOADS_PATH!, ...path))

/**
 * インポートは毎分 0 秒の定期タスクで取り込まれる。
 * アップロードした直後のファイルを確かめる前に取り込まれてしまわないよう、秒が 5〜40 の間になるまで待つ
 */
async function avoidImportTask() {
  await expect.poll(() => {
    const seconds = new Date().getSeconds()
    return seconds >= 5 && seconds <= 40
  }, { timeout: 60_000, intervals: [1000] }).toBe(true)
}

test('画像とインポートのファイルは storage/uploads/ に置く。画像は public/images/、縮小した画像は public/thumbs/、インポートのファイルは imports/ に置く', { tag: ['@TC-FT-NFR-DATA2', '@TC-FT-NFR-DATA3'] }, async ({ ownerPage, owner, ownerApi, project }) => {
  const card = await ownerApi.addCard(project.id)
  const image = await addImage(owner, project.id, card.id, await fileOf('small.png', MIME.png))
  expect(uploaded('public/images', image.filename)).toBe(true)

  // 縮小した画像は、初めて表示したときに作る
  await new ProjectScreen(ownerPage, project.id).openCard(card.id)
  await expect.poll(() => uploaded('public/thumbs', `${image.filename}.webp`)).toBe(true)

  await avoidImportTask()
  const imported = await uploadImport(owner, project.id, await fileOf('header-only.csv', MIME.csv))
  expect(uploaded('imports', imported.filename)).toBe(true)
})

test('インポートのファイルは、取り込みが終わると（エラーの場合も）消す', { tag: ['@TC-FT-NFR-DATA4'] }, async ({ ownerPage, owner, project, tag }) => {
  test.setTimeout(8 * 60_000)
  // 取り込めるファイルと、フォーマットエラーになるファイル（見出しの行しか無い）
  const done = { ...await fileOf('cards.csv', MIME.csv), name: `${tag}-done.csv` }
  const error = { ...await fileOf('header-only.csv', MIME.csv), name: `${tag}-error.csv` }
  // インポートを待っている間にプロジェクトの画面を直接開くとエラー画面になる（docs/ISSUES.md「インポート中にプロジェクトの画面を直接開くとエラー画面になる」）ので、先に開いておく
  const settings = new ProjectSettingsPage(ownerPage, project.id)
  await settings.open('インポート')
  const files = [await uploadImport(owner, project.id, done), await uploadImport(owner, project.id, error)]

  await settings.waitForImportResult(done.name)
  await settings.waitForImportResult(error.name)
  await expect(settings.historyCell(settings.historyRow(done.name), '結果')).toHaveText('インポート済')
  await expect(settings.historyCell(settings.historyRow(error.name), '結果')).toHaveText('フォーマットエラー')

  for (const file of files) expect(uploaded('imports', file.filename)).toBe(false)
})
