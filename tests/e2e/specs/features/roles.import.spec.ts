import { expect, test } from '../../fixtures'
import { ProjectListPage } from '../../pages/ProjectListPage'
import { MIME, ProjectScreen, ProjectSettingsPage } from '../../pages/ProjectSettingsPage'
import { TableViewPage } from '../../pages/TableViewPage'
import { IMPORT_TIMEOUT } from '../../support/imports'

// インポートは毎分 0 秒に動く定期の処理が 1 件ずつ取り込む。結果は画面で待つ（1 件あたり最大 1 分あまり）

test.describe('ユーザーストーリー', () => {
  test('編集者の設定にはインポートが無く、オーナーだけが同じIDのカードを一括で上書きし、ファイルに無いカードの編集者の書き込みは残る', { tag: ['@story', '@TC-FT-ROLES-US3'] }, async ({ ownerPage, ownerApi, project, newAccount, apiAs, pageAs, tag }) => {
    const first = await ownerApi.addCard(project.id, { みだし: '採集時の記録' })
    const second = await ownerApi.addCard(project.id, { みだし: '編集者が直す前' })
    const editor = await newAccount({ suffix: 'editor' })
    await ownerApi.invite(project.id, editor.username!)
    await (await apiAs(editor)).accept(project.id, editor.id)

    // 編集者は、一覧からプロジェクトを開いてカードを直す
    const editorPage = await pageAs(editor)
    const editorList = new ProjectListPage(editorPage)
    await editorList.open()
    await editorList.detailButton(project.name).click()
    await expect(editorPage).toHaveURL(`/projects/${project.id}`)
    const editorTv = new TableViewPage(editorPage)
    await expect(await editorTv.cellInput(second.id, 'みだし')).toHaveValue('編集者が直す前')
    await editorTv.editCell(second.id, 'みだし', '編集者が直した値')

    // 編集者のプロジェクト設定には「全般」だけがあり、インポートする手段が無い
    await editorTv.settingsLink.click()
    await expect(editorPage).toHaveURL(new RegExp(`/projects/${project.id}/settings`))
    const editorSettings = new ProjectSettingsPage(editorPage, project.id)
    await expect(editorSettings.exportButton).toBeVisible()
    await expect(editorSettings.tabs).toHaveCount(1)
    await expect(editorSettings.tab('インポート')).toHaveCount(0)

    // オーナーは、同じIDのカードを上書きするインポートで、ID 1 のカードを一括で直す
    const fileName = `一括修正${tag}.csv`
    const settings = new ProjectSettingsPage(ownerPage, project.id)
    await settings.open('インポート')
    await settings.chooseFile({ name: fileName, mimeType: MIME.csv, buffer: Buffer.from(`﻿ID,みだし\n${first.id},オーナーが一括で直した値\n`) })
    await settings.checkUpdate()
    await settings.startImport()
    await expect(ownerPage).toHaveURL(`/projects/${project.id}`)
    const screen = new ProjectScreen(ownerPage, project.id)
    await expect(screen.importedAlert).toBeVisible({ timeout: IMPORT_TIMEOUT })

    // オーナーの直したカードは上書きされ、ファイルに無いカードは編集者の書き込みのまま残る
    const tv = new TableViewPage(ownerPage)
    await expect(await tv.cellInput(first.id, 'みだし')).toHaveValue('オーナーが一括で直した値')
    await expect(await tv.cellInput(second.id, 'みだし')).toHaveValue('編集者が直した値')
    await expect(tv.idCells).toHaveText([String(first.id), String(second.id)])

    // 編集者からも、同じ内容が見える
    await editorTv.open(project.id)
    await expect(await editorTv.cellInput(first.id, 'みだし')).toHaveValue('オーナーが一括で直した値')
    await expect(await editorTv.cellInput(second.id, 'みだし')).toHaveValue('編集者が直した値')
  })
})
