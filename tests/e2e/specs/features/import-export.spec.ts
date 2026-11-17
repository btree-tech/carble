import { unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '../../fixtures'
import { addImage, fileOf, MIME, ProjectScreen, ProjectSettingsPage, uploadImport } from '../../pages/ProjectSettingsPage'
import { open } from '../../support/navigation'
import { knownIssue, spec, withIssue } from '../../support/spec'

test.describe('エクスポート', () => {
  test('【既知の問題】「エクスポート」を押しても、サーバーがエラー（500）を返してダウンロードが失敗する（あるべき: エクセルと画像を入れた zip をダウンロードする）', withIssue(
    spec('features/import-export.md',
      'エクスポート > プロジェクトのデータを zip ファイルでダウンロードする',
      'エクスポート > zip には、エクセルのファイル 1 つと、カードの画像のファイルを入れる',
      'エクスポート > エクセルのファイル名は「（プロジェクト名）.xlsx」とする',
      'エクスポート > エクセルのファイル名は > プロジェクト名にファイル名に使えない文字',
      'エクスポート > エクセルの 1 行目は見出しとし',
      'エクスポート > 2 行目以降に、カードを並び順の順に 1 行ずつ書く',
      'エクスポート > 2 行目以降に > 「画像ファイル」の列には',
      'エクスポート > 画像のファイル名は「（カードの ID）-（画像の番号）.（拡張子）」とする',
      'エクスポート > 画像のファイル名は > 画像の番号はシステム全体で',
      'エクスポート > 画像のファイル名は > 拡張子は、画面から添えた画像は画像の形式による',
      'エクスポート > 画像のファイル名は > 画像はフォルダに分けず',
      'pages/project-settings.md > 全般 > WHEN 「エクスポート」を押すと',
    ),
    knownIssue('docs/ISSUES.md', 'エクスポートが失敗する'),
  ), async ({ ownerPage, owner, ownerApi, project }) => {
    // 項目（非表示の項目を含む）・並び順を変えたカード・画像のあるプロジェクト
    const hidden = await ownerApi.addField(project.id, '非表示の項目')
    await ownerApi.setFieldVisible(project.id, hidden.id, false)
    const first = await ownerApi.addCard(project.id, { みだし: '一', 非表示の項目: '隠し値' })
    await ownerApi.addCard(project.id, { みだし: '二', メモ: 'メモ二' })
    await addImage(owner, project.id, first.id, await fileOf('png-named.jpg', 'image/jpeg'))

    const settings = new ProjectSettingsPage(ownerPage, project.id)
    await settings.open()
    const download = await settings.export()

    expect(await download.failure()).not.toBeNull()
    await expect(ownerApi.call('get', `/api/projects/${project.id}/export`)).rejects.toThrow(/: 500 /)
  })

  test('【既知の問題】画像のファイルがサーバーに無い画像があっても、エクスポートは（ダウンロードが終わらないのではなく）失敗で終わる（あるべき: その画像を除いた zip をダウンロードする）', withIssue(
    spec('features/import-export.md', 'エクスポート > IF 画像のファイルがサーバーに無い場合'),
    // ISSUES.md の「ダウンロードが終わらない」は、画像を書き出す前にエクスポートが失敗する（上のテスト）ため、今は現れない
    knownIssue('docs/ISSUES.md', '画像のファイルが無いとエクスポートが終わらない'),
  ), async ({ ownerPage, owner, ownerApi, project }) => {
    const card = await ownerApi.addCard(project.id, { みだし: '画像のファイルが無いカード' })
    const image = await addImage(owner, project.id, card.id, await fileOf('small.png', MIME.png))
    // 画像のファイルが無い状態は画面からは作れないので、app と共有のボリュームから消す（この既知の問題のテストだけ）
    unlinkSync(join(process.env.UPLOADS_PATH!, 'public/images', image.filename))

    const settings = new ProjectSettingsPage(ownerPage, project.id)
    await settings.open()
    const download = await settings.export()

    // 終わらないなら failure() はテストの時間切れまで返らない
    expect(await download.failure()).not.toBeNull()
  })
})

test.describe('インポート中の画面', () => {
  test('インポートを待っている間は「インポート中です」のダイアログでアップロードの日時とファイル名を表示し、カードを表示しない。「ホームに戻る」でプロジェクト一覧に遷移する', spec('features/import-export.md',
    'インポート中の画面 > WHILE プロジェクトのインポートを待っている間・取り込んでいる間は',
    'インポート中の画面 > WHILE プロジェクトのインポートを待っている間 > 「現在、（アップロードした日時） にアップロードされた',
    'インポート中の画面 > WHILE プロジェクトのインポートを待っている間 > 「再読み込み」ボタンで',
    'インポート中の画面 > WHILE プロジェクトのインポートを待っている間 > 「ホームに戻る」ボタンで',
  ), async ({ ownerPage, owner, ownerApi, project, tag }) => {
    await ownerApi.addCard(project.id, { みだし: '隠れるカード' })
    const file = await fileOf('header-only.csv', MIME.csv)
    try {
      // 定期の処理が 1 件取り込んでも待っている状態が続くよう、2 件アップロードする
      const before = Date.now()
      await uploadImport(owner, project.id, { ...file, name: `${tag}-1.csv` })
      await uploadImport(owner, project.id, { ...file, name: `${tag}-2.csv` })
      const after = Date.now()

      const screen = new ProjectScreen(ownerPage, project.id)
      await screen.openTableView()

      await expect(screen.importingDialog).toBeVisible()
      // 待っているインポートのどちらか（同じ秒にアップロードしたので、どちらが新しいかは決まらない）。日時は端末の表示形式（ja-JP）
      const message = await screen.importingMessage.innerText()
      const match = message.match(new RegExp(`^現在、 ?(\\d{4})/(\\d{1,2})/(\\d{1,2}) (\\d{1,2}):(\\d{2}):(\\d{2}) にアップロードされた ${tag}-[12]\\.csv を処理中です。$`))
      expect(match, message).not.toBeNull()
      const [, y, mo, d, h, mi, s] = match!.map(Number)
      const uploadedAt = Date.UTC(y, mo - 1, d, h - 9, mi, s)
      expect(uploadedAt).toBeGreaterThanOrEqual(Math.floor(before / 1000) * 1000 - 1_000)
      expect(uploadedAt).toBeLessThanOrEqual(after + 1_000)
      await expect(screen.reloadButton).toBeVisible()
      await expect(screen.homeButton).toBeVisible()
      await expect(ownerPage.getByText('隠れるカード')).toHaveCount(0)
      await expect(screen.table).toHaveCount(0)

      // 「再読み込み」で確かめても、待っている間は閉じない
      await screen.reloadButton.click()
      await expect(screen.reloadButton).toBeEnabled()
      await expect(screen.importingDialog).toBeVisible()

      await screen.homeButton.click()
      await expect(ownerPage).toHaveURL('/')
    } finally {
      // 待っているインポートを残すと、全体の取り込みの順番を待たせるので、プロジェクトごと消す
      await ownerApi.call('delete', `/api/projects/${project.id}`)
    }
  })

  test('インポート中のプロジェクトは、カードの複製先に「インポート中」と表示し、選べない', spec('features/import-export.md',
    'インポート中の画面 > WHILE インポート中は、そのプロジェクトを複製先に選べない',
  ), async ({ ownerPage, owner, ownerApi, project, tag }) => {
    const other = await ownerApi.createProject(`複製元${tag}`)
    await ownerApi.addCard(other.id, { みだし: '複製するカード' })
    const file = await fileOf('header-only.csv', MIME.csv)
    try {
      await uploadImport(owner, project.id, { ...file, name: `${tag}-1.csv` })
      await uploadImport(owner, project.id, { ...file, name: `${tag}-2.csv` })

      const screen = new ProjectScreen(ownerPage, other.id)
      await screen.openTableView()
      await screen.cardRows.first().getByRole('checkbox').check()
      // 「複製」はポップオーバーの枠と中のボタンの 2 つが当たるので、外側を押す
      await ownerPage.getByRole('button', { name: '複製', exact: true }).first().click()

      const target = ownerPage.getByRole('button', { name: new RegExp(project.name) })
      await expect(target).toContainText('インポート中')
      await expect(target).toBeDisabled()
    } finally {
      await ownerApi.call('delete', `/api/projects/${project.id}`)
    }
  })

  test('【既知の問題】インポート中に、設定などテーブルビュー以外のプロジェクトの画面を直接開くと、エラー画面（409）になる（あるべき: 「インポート中です」のダイアログを表示する）', withIssue(
    spec('features/import-export.md', 'インポート中の画面 > WHILE プロジェクトのインポートを待っている間・取り込んでいる間は'),
    knownIssue('docs/ISSUES.md', 'インポート中にプロジェクトの画面を直接開くとエラー画面になる'),
  ), async ({ ownerPage, owner, ownerApi, project, tag }) => {
    const file = await fileOf('header-only.csv', MIME.csv)
    try {
      await uploadImport(owner, project.id, { ...file, name: `${tag}-1.csv` })
      await uploadImport(owner, project.id, { ...file, name: `${tag}-2.csv` })

      for (const path of [`/projects/${project.id}/settings`, `/projects/${project.id}/settings/import`, `/projects/${project.id}/grid`]) {
        const response = await ownerPage.goto(path)
        expect(response?.status(), path).toBe(409)
        await expect(ownerPage.getByText('409')).toBeVisible()
        await expect(ownerPage.getByText('インポート中です', { exact: true })).toHaveCount(0)
      }

      // テーブルビュー（末尾に / が無い）はダイアログを表示する
      await open(ownerPage, `/projects/${project.id}`)
      await expect(new ProjectScreen(ownerPage, project.id).importingDialog).toBeVisible()
    } finally {
      await ownerApi.call('delete', `/api/projects/${project.id}`)
    }
  })
})
