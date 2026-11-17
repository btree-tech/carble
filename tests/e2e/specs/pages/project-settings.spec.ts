import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '../../fixtures'
import {
  addImage,
  fileOf,
  MIME,
  parseDisplayedDate,
  ProjectSettingsPage,
  settingsFile,
  tokyoTimestamp,
  uploadImport,
} from '../../pages/ProjectSettingsPage'
import { open } from '../../support/navigation'
import { knownIssue, spec, withIssue } from '../../support/spec'

/** 時計が次の秒になるまで待つ（アップロードした日時は秒まで記録する） */
async function nextSecond() {
  const second = Math.floor(Date.now() / 1000)
  await expect.poll(() => Math.floor(Date.now() / 1000), { intervals: [50] }).toBeGreaterThan(second)
}

test.describe('ヘッダー', () => {
  test('オーナーには、プロジェクト名・「テーブルビュー」ボタンと、全般・インポート・ユーザー管理・プロジェクト削除のタブを表示する', spec('pages/project-settings.md',
    'ヘッダー > プロジェクト名、「テーブルビュー」ボタン、タブを表示する',
    'ヘッダー > タブは「全般」とする > WHERE オーナーの場合',
  ), async ({ ownerPage, project }) => {
    const settings = new ProjectSettingsPage(ownerPage, project.id)
    await settings.open()

    await expect(settings.projectName(project.name).filter({ visible: true })).toBeVisible()
    await expect(settings.tableViewButton).toBeVisible()
    await expect(settings.tableViewLabel).toBeVisible()
    await expect(settings.tabs).toHaveText([/全般$/, /インポート$/, /ユーザー管理$/, /プロジェクト削除$/])
  })

  test('「テーブルビュー」を押すと、テーブルビューに遷移する', spec('pages/project-settings.md',
    'ヘッダー > プロジェクト名、「テーブルビュー」ボタン、タブを表示する > WHEN 「テーブルビュー」を押すと',
  ), async ({ ownerPage, project }) => {
    const settings = new ProjectSettingsPage(ownerPage, project.id)
    await settings.open()

    await settings.tableViewButton.click()

    await expect(ownerPage).toHaveURL(`/projects/${project.id}`)
  })

  test('オーナー以外（編集者）には「全般」のタブだけを表示する', spec('pages/project-settings.md',
    'ヘッダー > タブは「全般」とする',
  ), async ({ ownerApi, project, newAccount, pageAs, apiAs }) => {
    const editor = await newAccount({ suffix: 'editor' })
    await ownerApi.invite(project.id, editor.username!)
    await (await apiAs(editor)).accept(project.id, editor.id)

    const settings = new ProjectSettingsPage(await pageAs(editor), project.id)
    await settings.open()

    await expect(settings.tabs).toHaveText([/全般$/])
    await expect(settings.exportButton).toBeVisible()
  })

  test('【実装との乖離】オーナー以外も URL を直接開くとユーザー管理・プロジェクト削除の画面を表示し、招待は「存在しないIDです」、削除はメッセージなしで失敗する（あるべき: オーナー以外は開けない）', withIssue(
    spec('pages/project-settings.md', 'ヘッダー > タブは「全般」とする > WHERE オーナーの場合'),
    knownIssue('pages/project-settings.md', 'オーナー以外にはタブを表示しないが、URL を直接開くと「インポート」「ユーザー管理」「プロジェクト削除」の画面を表示する'),
  ), async ({ ownerApi, project, newAccount, pageAs, apiAs }) => {
    const editor = await newAccount({ suffix: 'editor' })
    const other = await newAccount({ suffix: 'other' })
    await ownerApi.invite(project.id, editor.username!)
    await (await apiAs(editor)).accept(project.id, editor.id)
    const editorPage = await pageAs(editor)
    const settings = new ProjectSettingsPage(editorPage, project.id)

    await settings.open('ユーザー管理')
    await expect(settings.inviteInput).toBeVisible()
    await settings.invite(other.username!)
    await expect(editorPage.getByText('存在しないIDです')).toBeVisible()

    await settings.open('プロジェクト削除')
    editorPage.once('dialog', (dialog) => dialog.accept())
    const response = editorPage.waitForResponse((r) => r.request().method() === 'DELETE' && r.url().endsWith(`/api/projects/${project.id}`))
    await settings.deleteProjectButton.click()
    expect((await response).status()).toBe(404)
    await expect(editorPage).toHaveURL(`/projects/${project.id}/settings/delete`)
    await expect(editorPage.getByText('プロジェクトを削除しました')).toBeHidden()
    // プロジェクトは残っている
    expect(await ownerApi.fields(project.id)).toHaveLength(2)
  })
})

test.describe('全般', () => {
  test('「エクスポート」ボタンを表示し、押すと「（プロジェクト名）-（端末の年月日時分秒）.zip」の名前でダウンロードを始める', spec('pages/project-settings.md',
    '全般 > 「エクスポート」ボタンを表示する',
    'features/import-export.md > エクスポート > プロジェクトのデータを zip ファイルでダウンロードする > ファイル名は「（プロジェクト名）-（年月日時分秒）.zip」とする',
  ), async ({ ownerPage, project }) => {
    const settings = new ProjectSettingsPage(ownerPage, project.id)
    await settings.open()
    await expect(settings.exportButton).toBeVisible()

    // 秒の境目をまたいでもよいよう、押す前と後の日時で挟む
    const before = new Date(Date.now() - 1_000)
    const download = await settings.export()
    const after = new Date()

    const name = download.suggestedFilename()
    const match = name.match(new RegExp(`^${project.name}-(\\d{14})\\.zip$`))
    expect(match, name).not.toBeNull()
    expect(match![1] >= tokyoTimestamp(before) && match![1] <= tokyoTimestamp(after), name).toBe(true)
    // ダウンロードの中身は features/import-export.spec.ts で確かめる（今は失敗する）
  })
})

test.describe('インポート', () => {
  test('ファイルの選択・「同じIDのカードを上書きする」・「インポート」と案内を表示し、ファイルを選ぶまで「インポート」を押せない', spec('pages/project-settings.md',
    'インポート > ファイルの選択、「同じIDのカードを上書きする」チェック、「インポート」ボタンを表示する',
    'インポート > ファイルの選択、 > 「xlsx,csv,zipファイルのいずれか（600MBまで）を選択してください」',
    'インポート > ファイルの選択、 > WHEN 「ファイルを選択」を押すと',
    'インポート > ファイルの選択、 > WHILE ファイルを選んでいない間は',
  ), async ({ ownerPage, project }) => {
    const settings = new ProjectSettingsPage(ownerPage, project.id)
    await settings.open('インポート')

    await expect(settings.chooseFileButton).toBeVisible()
    await expect(settings.updateCheckbox).not.toBeChecked()
    await expect(ownerPage.getByText('xlsx,csv,zipファイルのいずれか（600MBまで）を選択してください', { exact: true })).toBeVisible()
    await expect(ownerPage.getByText('zipファイルを選択し、かつ画像ファイル列が存在する場合、列で指定された画像ファイルを取り込みます', { exact: true })).toBeVisible()
    await expect(settings.importButton).toBeDisabled()

    const chooser = await settings.openFileChooser()
    expect(chooser.isMultiple()).toBe(false)
    // 選べるファイルの種類（ファイルを選ぶ画面に渡す accept 属性）
    expect((await chooser.element().getAttribute('accept'))?.split(',')).toEqual([
      'application/zip',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ])
    await chooser.setFiles(settingsFile('cards.csv'))

    await expect(settings.chosenFile('cards.csv')).toBeVisible()
    await expect(settings.importButton).toBeEnabled()
  })

  test('「同じIDのカードを上書きする」をチェックすると、上書きとバックアップの案内のダイアログを表示し、「OK」で閉じる', spec('pages/project-settings.md',
    'インポート > WHEN 「同じIDのカードを上書きする」をチェックすると',
    'インポート > WHEN 「同じIDのカードを上書きする」をチェックすると > 「ID列に入力された数値と同IDのカードが存在する場合',
    'インポート > WHEN 「同じIDのカードを上書きする」をチェックすると > 「これからデータの更新を行います。',
    'インポート > WHEN 「同じIDのカードを上書きする」をチェックすると > WHEN 「OK」を押すと',
  ), async ({ ownerPage, project }) => {
    const settings = new ProjectSettingsPage(ownerPage, project.id)
    await settings.open('インポート')

    await settings.updateCheckbox.check()

    await expect(settings.dialog.getByText('ID列に入力された数値と同IDのカードが存在する場合、そのカードの内容を上書きします。')).toBeVisible()
    await expect(settings.dialog.getByText('これからデータの更新を行います。現状のプロジェクトの状態を残しておきたい場合はバックアップを残しておくこと（プロジェクトデータの「エクスポート」）をお勧めします。')).toBeVisible()
    await expect(settings.okButton).toBeVisible()

    await settings.okButton.click()

    await expect(settings.okButton).toBeHidden()
    await expect(ownerPage.getByText('ID列に入力された数値と同IDのカードが存在する場合')).toBeHidden()
    await expect(settings.updateCheckbox).toBeChecked()
  })

  test('【実装との乖離】アップロードに失敗しても（xlsx・csv・zip でないファイル）、メッセージを表示せず画面に留まる（あるべき: 失敗したことを表示する）', withIssue(
    spec('pages/project-settings.md', 'インポート > WHEN 「インポート」を押すと > IF アップロードに失敗した場合'),
    knownIssue('pages/project-settings.md', 'インポートのアップロードに失敗しても（ブラウザが送るファイルの種類が xlsx・csv・zip のどれとも判定されない場合など）、メッセージを表示しない'),
  ), async ({ ownerPage, project }) => {
    const settings = new ProjectSettingsPage(ownerPage, project.id)
    await settings.open('インポート')
    // ファイルを選ぶ画面の種類の絞り込みを使わずに選んだ場合（setFiles は accept を見ない）
    await settings.chooseFile(settingsFile('memo.txt'))

    const response = ownerPage.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith(`/api/projects/${project.id}/imports`))
    await settings.startImport()

    // サーバーはファイルの種類が違うとして受け付けない（422）
    expect((await response).ok()).toBe(false)
    await expect(settings.importButton).toBeEnabled()
    await expect(ownerPage).toHaveURL(`/projects/${project.id}/settings/import`)
    await expect(settings.chosenFile('memo.txt')).toBeVisible()
    await expect(settings.historyRows).toHaveText(['No items.'])
  })

  test('インポート履歴を新しい順に 10 件ずつ「インポート日時」「ファイル名」「結果」で表示し、下にページを切り替えるボタンを表示する', spec('pages/project-settings.md',
    'インポート > 「インポート履歴」に、このプロジェクトのインポートを新しい順に 10 件ずつ表示する',
    'インポート > 「インポート履歴」に > 列は「インポート日時」「ファイル名」「結果」とする',
    'インポート > 「インポート履歴」に > 列は「インポート日時」 > 「インポート日時」は、ファイルをアップロードした日時とする',
    'インポート > 「インポート履歴」に > 履歴の下に、ページを切り替えるボタンを表示する',
    'インポート > 「インポート履歴」に > WHERE インポートの履歴が無い場合、「No items.」と表示する',
    'インポート > 「インポート履歴」に > 結果は次のとおり表示する',
    'インポート > インポートを待っている | 未処理',
  ), async ({ ownerPage, owner, ownerApi, project, tag }) => {
    const settings = new ProjectSettingsPage(ownerPage, project.id)
    // インポートを待っている間はプロジェクトの画面を開けないので、先に開いておき、画面の中の遷移で読み直す
    await settings.open('インポート')
    await expect(settings.historyRows).toHaveText(['No items.'])
    await expect(settings.pagination).toHaveCount(0)

    const header = await fileOf('header-only.csv', MIME.csv)
    const names = Array.from({ length: 11 }, (_, i) => `${tag}-${String(i + 1).padStart(2, '0')}.csv`)
    try {
      // 1 件（10 件以下）
      const before = Date.now()
      await uploadImport(owner, project.id, { ...header, name: names[0] })
      const after = Date.now()
      await settings.reloadHistory()
      await expect(settings.historyRows).toHaveCount(1)
      await expect(settings.pagination).toHaveText(['1'])
      const uploadedAt = parseDisplayedDate(await settings.historyCell(settings.historyRows.first(), 'インポート日時').innerText()).getTime()
      // 画面は秒までの表示
      expect(uploadedAt).toBeGreaterThanOrEqual(Math.floor(before / 1000) * 1000 - 1_000)
      expect(uploadedAt).toBeLessThanOrEqual(after + 1_000)

      // 11 件。新しい順はアップロードした日時（秒まで）で並べるので、1 秒ずつずらしてアップロードする
      for (const name of names.slice(1)) {
        await nextSecond()
        await uploadImport(owner, project.id, { ...header, name })
      }
      await settings.reloadHistory()

      await expect(settings.historyTable.getByRole('columnheader')).toContainText(['インポート日時', 'ファイル名', '結果'])
      await expect(settings.historyRows).toHaveCount(10)
      for (let i = 0; i < 10; i++) {
        await expect(settings.historyCell(settings.historyRows.nth(i), 'ファイル名')).toHaveText(names[10 - i])
      }
      // 待っている間は「未処理」（定期の処理は毎分 1 件ずつなので、いちばん新しいものはまだ取り込まれていない）
      await expect(settings.historyCell(settings.historyRows.first(), '結果')).toHaveText('未処理')
      await expect(settings.pagination).toHaveText(['1', '2'])

      await settings.pageButton(2).click()
      await expect(settings.historyRows).toHaveCount(1)
      await expect(settings.historyCell(settings.historyRows.first(), 'ファイル名')).toHaveText(names[0])
    } finally {
      // 待っているインポートを残すと、全体の取り込みの順番を待たせるので、プロジェクトごと消す
      await ownerApi.call('delete', `/api/projects/${project.id}`)
    }
  })
})

test.describe('ユーザー管理', () => {
  test('ユーザーを加えた順に、ユーザーID・権限（オーナーは「管理者」）・ステータス（招待中）と、オーナー以外の行に「削除」を表示する', spec('pages/project-settings.md',
    'ユーザー管理 > プロジェクトのユーザーを、プロジェクトに加えた順に一覧する',
    'ユーザー管理 > プロジェクトのユーザーを > 列は「ユーザーID」「権限」「ステータス」と削除ボタンとする',
    'ユーザー管理 > プロジェクトのユーザーを > オーナーの「権限」は「管理者」と表示する',
    'ユーザー管理 > プロジェクトのユーザーを > 招待中のユーザーの「ステータス」に「招待中」と表示する',
    'ユーザー管理 > プロジェクトのユーザーを > WHERE オーナー以外の行の場合、「削除」ボタンを表示する',
  ), async ({ ownerPage, owner, ownerApi, project, newAccount, apiAs }) => {
    const editor = await newAccount({ suffix: 'editor' })
    const invited = await newAccount({ suffix: 'invited' })
    await ownerApi.invite(project.id, editor.username!)
    await (await apiAs(editor)).accept(project.id, editor.id)
    await ownerApi.invite(project.id, invited.username!)

    const settings = new ProjectSettingsPage(ownerPage, project.id)
    await settings.open('ユーザー管理')

    await expect(settings.usersTable.getByRole('columnheader')).toHaveText(['ユーザーID', '権限', 'ステータス', ''])
    await expect(settings.userRows).toHaveCount(3)
    const rows = [
      [owner.username!, '管理者', ''],
      [editor.username!, '', ''],
      [invited.username!, '', '招待中'],
    ]
    for (const [i, [username, role, status]] of rows.entries()) {
      const cells = settings.userRows.nth(i).getByRole('cell')
      await expect(cells.nth(0)).toHaveText(username)
      await expect(cells.nth(1)).toHaveText(role)
      await expect(cells.nth(2)).toHaveText(status)
    }
    await expect(settings.userRows.nth(0).getByRole('button')).toHaveCount(0)
    await expect(settings.userRows.nth(1).getByRole('button', { name: '削除' })).toBeVisible()
    await expect(settings.userRows.nth(2).getByRole('button', { name: '削除' })).toBeVisible()
  })

  test('「削除」を押すと「削除してよろしいですか？」と確認し、確認するとプロジェクトから外して一覧から消す', spec('pages/project-settings.md',
    'ユーザー管理 > WHEN 「削除」を押すと、「削除してよろしいですか？」と確認する',
    'ユーザー管理 > WHEN 「削除」を押すと > WHEN 確認すると',
  ), async ({ ownerPage, ownerApi, project, newAccount, apiAs, pageAs }) => {
    const editor = await newAccount({ suffix: 'editor' })
    await ownerApi.invite(project.id, editor.username!)
    await (await apiAs(editor)).accept(project.id, editor.id)
    const settings = new ProjectSettingsPage(ownerPage, project.id)
    await settings.open('ユーザー管理')

    // 確認で取り消すと消さない
    let message = ''
    ownerPage.once('dialog', (dialog) => {
      message = dialog.message()
      void dialog.dismiss()
    })
    await settings.userRow(editor.username!).getByRole('button', { name: '削除' }).click()
    expect(message).toBe('削除してよろしいですか？')
    await expect(settings.userRow(editor.username!)).toBeVisible()

    ownerPage.once('dialog', (dialog) => void dialog.accept())
    await settings.userRow(editor.username!).getByRole('button', { name: '削除' }).click()

    await expect(settings.userRow(editor.username!)).toHaveCount(0)
    await expect(settings.userRows).toHaveCount(1)
    // 外したユーザーのプロジェクト一覧から消える
    const editorPage = await pageAs(editor)
    await open(editorPage, '/')
    await expect(editorPage.getByRole('cell', { name: project.name })).toHaveCount(0)
  })

  test('ユーザーIDを入れて「招待」を押すと、招待中として一覧に加えて入力欄を空にし、招待されたユーザーに通知する', spec('pages/project-settings.md',
    'ユーザー管理 > 「ユーザーIDを入力して招待」の入力欄と「招待」ボタンを表示する',
    'ユーザー管理 > 「ユーザーIDを入力して招待」 > 「これから他のメンバーを招待して共同編集を行えるようにします。」',
    'ユーザー管理 > 「ユーザーIDを入力して招待」 > WHEN ユーザーIDを入れて「招待」を押すと',
    'ユーザー管理 > 「ユーザーIDを入力して招待」 > WHEN ユーザーIDを入れて「招待」を押すと > 招待されたユーザーのプロジェクト一覧に招待の通知を表示する',
  ), async ({ ownerPage, project, newAccount, pageAs }) => {
    const invited = await newAccount({ suffix: 'invited' })
    const settings = new ProjectSettingsPage(ownerPage, project.id)
    await settings.open('ユーザー管理')

    await expect(settings.inviteInput).toBeVisible()
    await expect(settings.inviteButton).toBeVisible()
    await expect(ownerPage.getByText('これから他のメンバーを招待して共同編集を行えるようにします。')).toBeVisible()
    await expect(ownerPage.getByText('現状のプロジェクトの状態を残しておきたい場合はバックアップを残しておくこと（プロジェクトデータの「エクスポート」）をお勧めします。')).toBeVisible()

    await settings.invite(invited.username!)

    await expect(settings.userRow(invited.username!).getByRole('cell').nth(2)).toHaveText('招待中')
    await expect(settings.inviteInput).toHaveValue('')

    const invitedPage = await pageAs(invited)
    await open(invitedPage, '/')
    await expect(invitedPage.getByText(`「${project.name}」に招待されています`)).toBeVisible()
  })

  test('存在しないユーザーIDで招待すると「存在しないIDです」と表示し、招待しない', spec('pages/project-settings.md',
    'ユーザー管理 > 「ユーザーIDを入力して招待」 > IF 存在しないユーザーIDの場合',
  ), async ({ ownerPage, project, tag }) => {
    const settings = new ProjectSettingsPage(ownerPage, project.id)
    await settings.open('ユーザー管理')

    await settings.invite(`${tag}-nobody`)

    await expect(ownerPage.getByText('存在しないIDです')).toBeVisible()
    await expect(settings.userRows).toHaveCount(1)
  })

  test('ユーザーIDが 3 文字未満・30 文字を超えると、メッセージを表示せず、招待しない', spec('pages/project-settings.md',
    'ユーザー管理 > 「ユーザーIDを入力して招待」 > IF ユーザーIDが 3 文字未満または 30 文字を超える場合',
  ), async ({ ownerPage, project, newAccount }) => {
    // 長さのほかは招待できるユーザー（ユーザーIDは 2 文字と 31 文字）
    const short = await newAccount({ username: `${Math.random().toString(36).slice(2, 4)}` })
    const long = await newAccount({ username: `${short.username}${'x'.repeat(29)}` })
    const settings = new ProjectSettingsPage(ownerPage, project.id)
    await settings.open('ユーザー管理')
    const posted: string[] = []
    ownerPage.on('request', (r) => {
      if (r.method() === 'POST' && r.url().endsWith(`/api/projects/${project.id}/users`)) posted.push(r.url())
    })

    for (const username of [short.username!, long.username!]) {
      await settings.invite(username)
      await expect(settings.inviteInput).toHaveValue(username)
      await expect(ownerPage.getByText('存在しないIDです')).toBeHidden()
      await expect(settings.userRows).toHaveCount(1)
    }
    expect(posted).toEqual([])
  })

  test('【既知の問題】既にメンバー・招待中のユーザー（自分を含む）のユーザーIDで招待すると「存在しないIDです」と表示する（あるべき: 既に加わっていることを表示する）', withIssue(
    spec('pages/project-settings.md', 'ユーザー管理 > 「ユーザーIDを入力して招待」 > IF 存在しないユーザーIDの場合'),
    knownIssue('docs/ISSUES.md', '招待済みのユーザーを招待すると「存在しないIDです」と表示する'),
  ), async ({ ownerPage, owner, ownerApi, project, newAccount }) => {
    const invited = await newAccount({ suffix: 'invited' })
    await ownerApi.invite(project.id, invited.username!)
    const settings = new ProjectSettingsPage(ownerPage, project.id)
    await settings.open('ユーザー管理')

    for (const username of [invited.username!, owner.username!]) {
      await settings.invite(username)
      await expect(ownerPage.getByText('存在しないIDです')).toBeVisible()
      await expect(settings.userRows).toHaveCount(2)
      await settings.inviteInput.fill('')
    }
  })
})

test.describe('プロジェクト削除', () => {
  test('「プロジェクトを削除する」を押して確認すると、プロジェクトと関係・画像のファイルを削除し、「プロジェクトを削除しました」と表示して一覧に遷移する', spec('pages/project-settings.md',
    'プロジェクト削除 > 「プロジェクトを削除する」ボタンを表示する',
    'プロジェクト削除 > WHEN 「プロジェクトを削除する」を押すと、「削除してよろしいですか？」と確認する',
    'プロジェクト削除 > WHEN 「プロジェクトを削除する」を押すと > WHEN 確認すると',
  ), async ({ ownerPage, owner, ownerApi, project, newAccount, apiAs, pageAs }) => {
    const editor = await newAccount({ suffix: 'editor' })
    const invited = await newAccount({ suffix: 'invited' })
    await ownerApi.invite(project.id, editor.username!)
    await (await apiAs(editor)).accept(project.id, editor.id)
    await ownerApi.invite(project.id, invited.username!)
    const card = await ownerApi.addCard(project.id, { みだし: '消えるカード' })
    const image = await addImage(owner, project.id, card.id, await fileOf('small.png', MIME.png))
    // 画像のファイルの有無は画面に出ないので、app と共有のボリュームを見る（読むだけ）
    const imagePath = join(process.env.UPLOADS_PATH!, 'public/images', image.filename)
    expect(existsSync(imagePath)).toBe(true)

    const settings = new ProjectSettingsPage(ownerPage, project.id)
    await settings.open('プロジェクト削除')
    await expect(settings.deleteProjectButton).toBeVisible()

    // 確認で取り消すと削除しない
    let message = ''
    ownerPage.once('dialog', (dialog) => {
      message = dialog.message()
      void dialog.dismiss()
    })
    await settings.deleteProjectButton.click()
    expect(message).toBe('削除してよろしいですか？')
    await expect(ownerPage).toHaveURL(`/projects/${project.id}/settings/delete`)

    ownerPage.once('dialog', (dialog) => void dialog.accept())
    await settings.deleteProjectButton.click()

    await expect(ownerPage.getByText('プロジェクトを削除しました')).toBeVisible()
    await expect(ownerPage).toHaveURL('/')
    await expect(ownerPage.getByRole('cell', { name: project.name })).toHaveCount(0)
    expect(existsSync(imagePath)).toBe(false)

    // メンバー・招待中のユーザーとの関係も消える
    const editorPage = await pageAs(editor)
    await open(editorPage, '/')
    await expect(editorPage.getByRole('cell', { name: project.name })).toHaveCount(0)
    const invitedPage = await pageAs(invited)
    await open(invitedPage, '/')
    await expect(invitedPage.getByText(`「${project.name}」に招待されています`)).toHaveCount(0)
    // カード・項目も残らない（プロジェクトを開けない）
    await expect(ownerApi.call('get', `/api/projects/${project.id}/cards`)).rejects.toThrow(/404/)
  })
})
