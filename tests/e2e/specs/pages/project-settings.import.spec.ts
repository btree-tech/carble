import { expect, test } from '../../fixtures'
import { bomCsv, ProjectScreen, ProjectSettingsPage } from '../../pages/ProjectSettingsPage'
import { TableViewPage } from '../../pages/TableViewPage'

// インポートは毎分 0 秒に動く定期の処理が 1 件ずつ取り込む。結果は画面で待つ（1 件あたり最大 1 分あまり）

/** テーブルビューの行を、上から「ID・表示している項目の値」で確かめる */
async function expectCards(screen: ProjectScreen, rows: { id: string, values: string[] }[]) {
  await expect(screen.cardRows).toHaveCount(rows.length)
  for (const [i, row] of rows.entries()) {
    const locator = screen.cardRows.nth(i)
    await expect(screen.idCell(locator), `${i + 1} 行目の ID`).toHaveText(row.id)
    for (const [j, value] of row.values.entries()) {
      await expect(screen.values(locator).nth(j), `ID ${row.id} の ${j + 1} 番目の値`).toHaveValue(value)
    }
  }
}

test.describe('ユーザーストーリー', () => {
  test('オーナーが、テーブルビューから設定のインポートを開き、上書きの説明とバックアップの勧めを読んでから上書きを選んで表計算のファイルを取り込み、既存のカードを更新し新しいカードを登録する', { tag: ['@story', '@TC-PG-PSET-US2'] }, async ({ ownerPage, ownerApi, project, tag }) => {
    await ownerApi.addCard(project.id, { みだし: '直す前の値', メモ: '直す前のメモ' })
    await ownerApi.addCard(project.id, { みだし: 'そのままのカード', メモ: '残すメモ' })

    // テーブルビューから、プロジェクト設定へ
    const table = new TableViewPage(ownerPage)
    await table.open(project.id)
    await table.settingsLink.click()
    await expect(ownerPage).toHaveURL(`/projects/${project.id}/settings`)
    const settings = new ProjectSettingsPage(ownerPage, project.id)
    // バックアップの手段（「全般」の「エクスポート」）がある。押すとサーバーのエラーで失敗するので押さない（docs/ISSUES.md「エクスポートが失敗する」）
    await expect(settings.exportButton).toBeVisible()
    await settings.tab('インポート').click()
    await expect(settings.chooseFileButton).toBeVisible()

    // 表計算ソフトで作ったファイル。ID 1 は既存のカードの更新、ID の無い行は新しいカードの登録
    const file = bomCsv(`${tag}-update.csv`, [
      ['ID', 'みだし', 'メモ'],
      ['1', '表計算で直した値', '表計算で直したメモ'],
      ['', '新しく登録するカード', '新しいメモ'],
    ])
    await settings.chooseFile(file)
    await expect(settings.chosenFile(file.name)).toBeVisible()
    // 上書きは、選ばない限りしない
    await expect(settings.updateCheckbox).not.toBeChecked()

    // 上書きを選ぶと、上書きの説明とバックアップの勧めを読んでから「OK」で閉じる
    await settings.updateCheckbox.check()
    await expect(settings.dialog.getByText('ID列に入力された数値と同IDのカードが存在する場合、そのカードの内容を上書きします。')).toBeVisible()
    await expect(settings.dialog.getByText('現状のプロジェクトの状態を残しておきたい場合はバックアップを残しておくこと（プロジェクトデータの「エクスポート」）をお勧めします。')).toBeVisible()
    await settings.okButton.click()
    await expect(settings.okButton).toBeHidden()
    await expect(settings.updateCheckbox).toBeChecked()

    await settings.startImport()

    const screen = new ProjectScreen(ownerPage, project.id)
    await expect(ownerPage).toHaveURL(`/projects/${project.id}`)
    await expect(screen.importingDialog).toBeVisible()
    await screen.waitForImportDone()

    await expect(screen.importedAlert).toBeVisible()
    await expectCards(screen, [
      { id: '1', values: ['表計算で直した値', '表計算で直したメモ'] },
      { id: '2', values: ['そのままのカード', '残すメモ'] },
      // 新しいカードの ID は、プロジェクトとファイルの ID のいちばん大きい数字（2）の次
      { id: '3', values: ['新しく登録するカード', '新しいメモ'] },
    ])

    // 結果はインポート履歴にも残る
    await ownerPage.getByRole('link', { name: '詳細' }).click()
    await expect(ownerPage).toHaveURL(`/projects/${project.id}/settings/import`)
    await expect(settings.historyCell(settings.historyRow(file.name), '結果')).toHaveText('インポート済')
  })
})
