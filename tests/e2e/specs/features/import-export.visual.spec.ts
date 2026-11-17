import { expect, test } from '../../fixtures/visual'
import { fileOf, MIME, ProjectScreen, uploadImport } from '../../pages/ProjectSettingsPage'
import { expectScreen } from '../../support/visual'

test('インポートを待っている間のテーブルビュー（「インポート中です」のダイアログ）', { tag: ['@TC-FT-IMPEXP-VRT1'] }, async ({ visualPage, visualOwner, sample }) => {
  // 定期の処理が 1 件取り込んでも待っている状態が続くよう、2 件アップロードする（待たせたインポートは fixtures が消す）
  const file = { ...await fileOf('header-only.csv', MIME.csv), name: '観察記録.csv' }
  await uploadImport(visualOwner, sample.project.id, file)
  await uploadImport(visualOwner, sample.project.id, file)

  const screen = new ProjectScreen(visualPage, sample.project.id)
  await screen.openTableView()
  await expect(screen.importingDialog).toBeVisible()

  // 「現在、（アップロードした日時） にアップロードされた…」は実行ごとに変わるので塗る
  await expectScreen(visualPage, { mask: [screen.importingMessage] })
})
