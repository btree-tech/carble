import type { Page } from '@playwright/test'
import { expect, test } from '../../fixtures'
import { LoginPage } from '../../pages/LoginPage'
import { ProjectListPage } from '../../pages/ProjectListPage'
import { ProjectScreens } from '../../pages/ProjectScreens'
import { UserFormPage } from '../../pages/UserFormPage'

/** 確認のダイアログ（window.confirm）に「OK」で答えるようにしておく */
function acceptNextDialog(page: Page) {
  page.once('dialog', (dialog) => dialog.accept())
}

test.describe('画面', () => {
  test('ブラウザのタイトルは「Carble」とする', { tag: ['@TC-FT-LAYOUT-SCR1'] }, async ({ ownerPage, pageAs, project, ownerApi }) => {
    const card = await ownerApi.addCard(project.id)
    const login = new LoginPage(await pageAs('guest'))
    await login.open()
    await expect(login.page).toHaveTitle('Carble')

    const screens = new ProjectScreens(ownerPage)
    const paths = ['/', '/users/edit', ...Object.values(ProjectScreens.paths(project.id, card.id))]
    for (const path of paths) {
      await screens.open(path)
      await expect(ownerPage, path).toHaveTitle('Carble')
    }
  })
})

test.describe('保存状態のアイコン', () => {
  test('プロジェクトの画面で入力した値は、保存ボタンを押さずに自動で保存する', { tag: ['@TC-FT-LAYOUT-SAVE1'] }, async ({ ownerPage, ownerApi, project, tag }) => {
    const card = await ownerApi.addCard(project.id)
    const screens = new ProjectScreens(ownerPage)

    // プロジェクト名（テーブルビュー）
    await screens.open(ProjectScreens.paths(project.id).table)
    await expect(ownerPage.getByRole('button', { name: '保存', exact: true })).toHaveCount(0)
    await screens.projectNameInput.fill(`自動で保存${tag}`)
    await expect(screens.layout.savedIcon).toHaveCSS('opacity', '1')

    // カードの値（カード入力ビュー）
    await screens.open(ProjectScreens.paths(project.id, card.id).card)
    await expect(ownerPage.getByRole('button', { name: '保存', exact: true })).toHaveCount(0)
    await screens.cardField('みだし').fill(`カードの値${tag}`)
    await expect(screens.layout.savedIcon).toHaveCSS('opacity', '1')

    // 開き直しても残っている
    await screens.open(ProjectScreens.paths(project.id, card.id).card)
    await expect(screens.cardField('みだし')).toHaveValue(`カードの値${tag}`)
    await expect(screens.text(`自動で保存${tag}`)).toBeVisible()
  })

  test('ユーザーIDと名前は自動で保存せず、「保存」ボタンで保存する', { tag: ['@TC-FT-LAYOUT-SAVE2'] }, async ({ ownerPage, owner, tag }) => {
    const form = new UserFormPage(ownerPage)
    await form.openEdit()

    await form.name.fill(`保存しない名前${tag}`)
    await expect(form.saveButton).toBeEnabled()
    // 「保存」を押さずに離れると、変わっていない
    const list = new ProjectListPage(ownerPage)
    await list.open()
    await expect(list.layout.userMenuButton(owner.name)).toBeVisible()
    await form.openEdit()
    await expect(form.name).toHaveValue(owner.name)
  })

  test('テーブルビューのヘッダーに、保存中は回転するアイコン、保存が終わるとチェックのアイコンを表示する', { tag: ['@TC-FT-LAYOUT-SAVE3', '@TC-FT-LAYOUT-SAVE4', '@TC-FT-LAYOUT-SAVE5'] }, async ({ ownerPage, project, tag }) => {
    const screens = new ProjectScreens(ownerPage)
    await screens.open(ProjectScreens.paths(project.id).table)
    // 保存する前は、チェックのアイコンは透明
    await expect(screens.layout.savedIcon).toHaveCSS('opacity', '0')
    const spinnerSeen = await screens.layout.watchSpinner()

    const saved = ownerPage.waitForResponse((r) => new URL(r.url()).pathname === `/api/projects/${project.id}` && r.request().method() === 'PUT')
    await screens.projectNameInput.fill(`保存${tag}`)
    await saved

    await expect(screens.layout.savedIcon).toHaveCSS('opacity', '1')
    await expect(screens.layout.savingIcon).toBeHidden()
    expect(await spinnerSeen()).toBe(true)
  })

  test('カード入力ビューのヘッダーに、保存中は回転するアイコン、保存が終わるとチェックのアイコンを表示する', { tag: ['@TC-FT-LAYOUT-SAVE4', '@TC-FT-LAYOUT-SAVE5'] }, async ({ ownerPage, ownerApi, project, tag }) => {
    const card = await ownerApi.addCard(project.id)
    const screens = new ProjectScreens(ownerPage)
    await screens.open(ProjectScreens.paths(project.id, card.id).card)
    await expect(screens.layout.savedIcon).toHaveCSS('opacity', '0')
    const spinnerSeen = await screens.layout.watchSpinner()

    const [field] = await ownerApi.fields(project.id)
    const saved = ownerPage.waitForResponse((r) => new URL(r.url()).pathname === `/api/projects/${project.id}/cards/${card.id}/fields/${field.id}` && r.request().method() === 'PUT')
    await screens.cardField('みだし').fill(`値${tag}`)
    await saved

    await expect(screens.layout.savedIcon).toHaveCSS('opacity', '1')
    await expect(screens.layout.savingIcon).toBeHidden()
    expect(await spinnerSeen()).toBe(true)
  })

  test('グリッドビューのヘッダーに、並び替えの保存中は回転するアイコン、保存が終わるとチェックのアイコンを表示する', { tag: ['@TC-FT-LAYOUT-SAVE4', '@TC-FT-LAYOUT-SAVE5'] }, async ({ ownerPage, ownerApi, project }) => {
    await ownerApi.addCard(project.id, { みだし: '一枚目' })
    await ownerApi.addCard(project.id, { みだし: '二枚目' })
    const screens = new ProjectScreens(ownerPage)
    await screens.open(ProjectScreens.paths(project.id).grid)
    await expect(screens.gridCards).toHaveCount(2)
    await expect(screens.layout.savedIcon).toHaveCSS('opacity', '0')
    const spinnerSeen = await screens.layout.watchSpinner()

    const saved = ownerPage.waitForResponse((r) => new URL(r.url()).pathname === `/api/projects/${project.id}/cards` && r.request().method() === 'PUT')
    await screens.gridCards.nth(1).dragTo(screens.gridCards.nth(0))
    await saved

    await expect(screens.layout.savedIcon).toHaveCSS('opacity', '1')
    await expect(screens.layout.savingIcon).toBeHidden()
    expect(await spinnerSeen()).toBe(true)
    // グリッドのカードには ID を表示している。2 枚目（ID: 2）が先頭に来た
    await expect(screens.gridCards.first()).toContainText('ID: 2')
  })

  test('保存に失敗すると、テーブルビュー・カード入力ビュー・グリッドビューのヘッダーに赤いエラーのアイコンを表示する', { tag: ['@TC-FT-LAYOUT-SAVE6'] }, async ({ ownerPage, ownerApi, project, tag }) => {
    const screens = new ProjectScreens(ownerPage)

    // カード入力ビュー: 開いている間にカードが消えた（別の画面で削除した）
    const card = await ownerApi.addCard(project.id)
    await ownerApi.addCard(project.id)
    await screens.open(ProjectScreens.paths(project.id, card.id).card)
    await expect(screens.layout.saveErrorIcon).toBeHidden()
    await ownerApi.call('delete', `/api/projects/${project.id}/cards/${card.id}`)
    await screens.cardField('みだし').fill(`失敗${tag}`)
    await expect(screens.layout.saveErrorIcon).toBeVisible()

    // グリッドビュー: 開いている間に別の画面でカードが増え、並び替えを受け付けない
    await ownerApi.addCard(project.id)
    await screens.open(ProjectScreens.paths(project.id).grid)
    await expect(screens.gridCards).toHaveCount(2)
    await ownerApi.addCard(project.id)
    await expect(screens.layout.saveErrorIcon).toBeHidden()
    await screens.gridCards.nth(1).dragTo(screens.gridCards.nth(0))
    await expect(screens.layout.saveErrorIcon).toBeVisible()

    // テーブルビュー: 開いている間にプロジェクトが消えた（別の画面で削除した）
    await screens.open(ProjectScreens.paths(project.id).table)
    await expect(screens.layout.saveErrorIcon).toBeHidden()
    await ownerApi.call('delete', `/api/projects/${project.id}`)
    await screens.projectNameInput.fill(`失敗${tag}`)
    await expect(screens.layout.saveErrorIcon).toBeVisible()
  })
})

test.describe('完了メッセージ', () => {
  test('カードを追加すると「追加しました」と表示する', { tag: ['@TC-FT-LAYOUT-MSG1', '@TC-FT-LAYOUT-MSG3'] }, async ({ ownerPage, project }) => {
    const screens = new ProjectScreens(ownerPage)
    await screens.open(ProjectScreens.paths(project.id).table)

    await screens.addCardButton.click()

    await expect(screens.layout.toast('追加しました')).toBeVisible()
    await expect(screens.tableRows).toHaveCount(1)
  })

  test('カードを複製すると、1 件ずつでも選択したカードでも「複製しました」と表示する', { tag: ['@TC-FT-LAYOUT-MSG4'] }, async ({ ownerPage, ownerApi, project, tag }) => {
    const card = await ownerApi.addCard(project.id)
    const other = await ownerApi.createProject(`複製先${tag}`)
    const screens = new ProjectScreens(ownerPage)
    await screens.open(ProjectScreens.paths(project.id).table)

    // 1 件ずつの複製
    await screens.cardMenuButton(card.id).click()
    await screens.menuItem('直下に複製').click()
    await expect(screens.layout.toast('複製しました')).toBeVisible()
    await expect(screens.tableRows).toHaveCount(2)

    // 選択したカードの複製
    await screens.open(ProjectScreens.paths(project.id).table)
    await screens.cardCheckbox(card.id).check()
    await screens.selectionButton('複製').click()
    await ownerPage.getByText(other.name, { exact: true }).click()
    await expect(ownerPage).toHaveURL(`/projects/${other.id}`)
    await expect(screens.layout.toast('複製しました')).toBeVisible()
  })

  test('カードを 1 件ずつ削除すると「削除しました」と表示する', { tag: ['@TC-FT-LAYOUT-MSG5'] }, async ({ ownerPage, ownerApi, project }) => {
    const card = await ownerApi.addCard(project.id)
    const screens = new ProjectScreens(ownerPage)
    await screens.open(ProjectScreens.paths(project.id).table)

    await screens.cardMenuButton(card.id).click()
    acceptNextDialog(ownerPage)
    await screens.menuItem('削除').click()

    await expect(screens.layout.toast('削除しました')).toBeVisible()
    await expect(screens.tableRows).toHaveCount(0)
  })

  test('スキャンで既存のカードに画像を追加すると「スキャン完了」「ID: （ID）のカードに画像を追加しました」と表示する', { tag: ['@TC-FT-LAYOUT-MSG6'] }, async ({ ownerPage, ownerApi, project }) => {
    const card = await ownerApi.addCard(project.id)
    const screens = new ProjectScreens(ownerPage)
    const qrCode = await screens.captureQrCode(project.id, card.id)
    await screens.open(ProjectScreens.paths(project.id).table)

    await screens.chooseImage(screens.scanButton, qrCode)

    const toast = screens.layout.toast('スキャン完了')
    await expect(toast).toBeVisible()
    await expect(toast).toContainText(`ID: ${card.id}のカードに画像を追加しました`)
    await expect(ownerPage).toHaveURL(`/projects/${project.id}/cards/${card.id}`)
  })

  test('スキャンで新しいカードを追加すると「スキャン完了」「新しいカードを追加しました」と表示する', { tag: ['@TC-FT-LAYOUT-MSG7'] }, async ({ ownerPage, project }) => {
    const screens = new ProjectScreens(ownerPage)
    const image = await screens.plainImage()
    await screens.open(ProjectScreens.paths(project.id).table)

    await screens.chooseImage(screens.scanButton, image)

    const toast = screens.layout.toast('スキャン完了')
    await expect(toast).toBeVisible()
    await expect(toast).toContainText('新しいカードを追加しました')
    await expect(ownerPage).toHaveURL(new RegExp(`/projects/${project.id}/cards/\\d+$`))
  })

  test('プロジェクトを削除すると「プロジェクトを削除しました」と表示する', { tag: ['@TC-FT-LAYOUT-MSG8'] }, async ({ ownerPage, project }) => {
    const screens = new ProjectScreens(ownerPage)
    await screens.open(ProjectScreens.paths(project.id).settingsDelete)

    acceptNextDialog(ownerPage)
    await screens.deleteProjectButton.click()

    await expect(ownerPage).toHaveURL('/')
    await expect(screens.layout.toast('プロジェクトを削除しました')).toBeVisible()
  })

  test('選択したカードの一括削除・項目の追加・画像の削除では、完了メッセージを表示しない', { tag: ['@TC-FT-LAYOUT-MSG2'] }, async ({ ownerPage, ownerApi, project, tag }) => {
    const first = await ownerApi.addCard(project.id)
    const second = await ownerApi.addCard(project.id)
    const screens = new ProjectScreens(ownerPage)

    // 選択したカードの一括削除
    await screens.open(ProjectScreens.paths(project.id).table)
    await screens.cardCheckbox(first.id).check()
    acceptNextDialog(ownerPage)
    await screens.selectionButton('削除').click()
    await expect(screens.tableRows).toHaveCount(1)
    await expect(screens.layout.toasts).toHaveCount(0)

    // 項目の追加
    await screens.fieldMenuButton.click()
    await screens.newFieldInput.fill(`項目${tag}`)
    await screens.newFieldInput.press('Enter')
    await expect(screens.tableColumnNames).toHaveText(['並び順', 'ID', 'みだし', 'メモ', `項目${tag}`])
    await expect(screens.layout.toasts).toHaveCount(0)

    // 画像の削除
    const image = await screens.plainImage()
    await screens.open(ProjectScreens.paths(project.id, second.id).card)
    await screens.chooseImage(screens.addImageButton, image)
    await expect(screens.cardImages).toHaveCount(1)
    await screens.cardImages.scrollIntoViewIfNeeded() // 縮小画像の読み込みで位置がずれ、表示の外に出ていることがある
    await screens.cardImages.hover({ force: true }) // 画像の上に操作ボタンの層が重なっていて、hover の判定を受け止めるため
    await screens.removeImageButton.click()
    await expect(screens.cardImages).toHaveCount(0)
    await expect(screens.layout.toasts).toHaveCount(0)
  })
})

test.describe('エラー画面', () => {
  test('存在しない画面を開くと、エラーの番号（404）を表示するエラー画面を表示する', { tag: ['@TC-FT-LAYOUT-ERR1'] }, async ({ ownerPage, project }) => {
    const screens = new ProjectScreens(ownerPage)

    for (const path of ['/no-such-page', `/projects/${project.id + 100000}`]) {
      const response = await ownerPage.goto(path)
      expect(response?.status(), path).toBe(404)
      await expect(screens.layout.errorCode(404), path).toBeVisible()
    }
  })
})

test.describe('ユーザーストーリー', () => {
  test('研究者が、カード入力ビューで保存ボタンを押さずに項目を入力し、保存中・保存済みのアイコンで残ったことを確かめ、開き直しても内容が残っている。別のメンバーが消したカードへの入力は、赤いエラーのアイコンで残らなかったと分かる', { tag: ['@story', '@TC-FT-LAYOUT-US1'] }, async ({ ownerPage, ownerApi, project, newAccount, apiAs, tag }) => {
    const card = await ownerApi.addCard(project.id)
    const other = await ownerApi.addCard(project.id)
    const member = await newAccount({ suffix: 'member' })
    await ownerApi.invite(project.id, member.username!)
    const memberApi = await apiAs(member)
    await memberApi.accept(project.id, member.id)
    const fields = await ownerApi.fields(project.id)
    const screens = new ProjectScreens(ownerPage)

    // 保存ボタンは無い。入力するだけで、保存中（回転）→ 保存済み（チェック）のアイコンに変わる
    await screens.open(ProjectScreens.paths(project.id, card.id).card)
    await expect(ownerPage.getByRole('button', { name: '保存', exact: true })).toHaveCount(0)
    await expect(screens.layout.savedIcon).toHaveCSS('opacity', '0')
    const spinnerSeen = await screens.layout.watchSpinner()
    // 2 つの項目の保存が両方終わるのを待つ（カード入力ビューの裏に隠れたテーブルビューも同じ保存を送ることがあるので、項目ごとに 1 つ待つ）
    const saves = ['みだし', 'メモ'].map((name) => {
      const field = fields.find((f) => f.name === name)!
      const path = `/api/projects/${project.id}/cards/${card.id}/fields/${field.id}`
      return ownerPage.waitForResponse((r) => new URL(r.url()).pathname === path && r.request().method() === 'PUT' && r.ok())
    })
    await screens.cardField('みだし').fill(`資料の題${tag}`)
    await screens.cardField('メモ').fill(`資料のメモ${tag}`)
    await Promise.all(saves)

    await expect(screens.layout.savedIcon).toHaveCSS('opacity', '1')
    await expect(screens.layout.savingIcon).toBeHidden()
    await expect(screens.layout.saveErrorIcon).toBeHidden()
    expect(await spinnerSeen()).toBe(true)

    // テーブルビューで開き直しても、カード入力ビューで開き直しても、入力した内容が残っている
    await screens.open(ProjectScreens.paths(project.id).table)
    await expect(screens.tableCell(card.id, 0)).toHaveValue(`資料の題${tag}`)
    await expect(screens.tableCell(card.id, 1)).toHaveValue(`資料のメモ${tag}`)
    await screens.open(ProjectScreens.paths(project.id, card.id).card)
    await expect(screens.cardField('みだし')).toHaveValue(`資料の題${tag}`)
    await expect(screens.cardField('メモ')).toHaveValue(`資料のメモ${tag}`)

    // 開いている間に、別のメンバーがそのカードを削除した。入力しても保存に失敗し、赤いエラーのアイコンで分かる
    await screens.open(ProjectScreens.paths(project.id, other.id).card)
    await expect(screens.layout.saveErrorIcon).toBeHidden()
    await memberApi.call('delete', `/api/projects/${project.id}/cards/${other.id}`)
    await screens.cardField('みだし').fill(`残らない入力${tag}`)
    await expect(screens.layout.saveErrorIcon).toBeVisible()
  })

  test('研究者が、テーブルビューでカードを追加・複製・削除し、最後にプロジェクトを削除するまで、操作ごとに画面の隅の完了メッセージで終わったことを確かめる', { tag: ['@story', '@TC-FT-LAYOUT-US2'] }, async ({ ownerPage, project }) => {
    const screens = new ProjectScreens(ownerPage)
    await screens.open(ProjectScreens.paths(project.id).table)

    // カードを追加する（まっさらなプロジェクトなので ID は 1）
    await screens.addCardButton.click()
    await expect(screens.layout.toast('追加しました')).toBeVisible()
    await expect(screens.tableRows).toHaveCount(1)

    // 追加したカードを直下に複製する（ID は 2）
    await screens.cardMenuButton(1).click()
    await screens.menuItem('直下に複製').click()
    await expect(screens.layout.toast('複製しました')).toBeVisible()
    await expect(screens.tableRows).toHaveCount(2)

    // 複製したカードを削除する
    await screens.cardMenuButton(2).click()
    acceptNextDialog(ownerPage)
    await screens.menuItem('削除').click()
    await expect(screens.layout.toast('削除しました')).toBeVisible()
    await expect(screens.tableRows).toHaveCount(1)
    await expect(screens.tableRow(2)).toHaveCount(0)

    // 使い終わったプロジェクトを削除する
    await screens.open(ProjectScreens.paths(project.id).settingsDelete)
    acceptNextDialog(ownerPage)
    await screens.deleteProjectButton.click()
    await expect(ownerPage).toHaveURL('/')
    await expect(screens.layout.toast('プロジェクトを削除しました')).toBeVisible()
    await expect(ownerPage.getByRole('cell', { name: project.name })).toHaveCount(0)
  })
})
