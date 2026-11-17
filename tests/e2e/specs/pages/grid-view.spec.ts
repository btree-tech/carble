import { expect, test } from '../../fixtures'
import { addImageByApi, effectiveOpacity, listCardsByApi } from '../../pages/CardViewPage'
import { GridViewPage } from '../../pages/GridViewPage'
import { spec } from '../../support/spec'

const SPEC = 'pages/grid-view.md'

test.describe('ヘッダー', () => {
  test('プロジェクト名・「テーブルビュー」・保存状態のアイコンを表示し、「テーブルビュー」を押すとテーブルビューに遷移する', spec(SPEC,
    'ヘッダー > プロジェクト名、「テーブルビュー」ボタン、保存状態のアイコンを表示する',
    'ヘッダー > プロジェクト名、「テーブルビュー」ボタン、保存状態のアイコンを表示する > WHEN 「テーブルビュー」を押す',
  ), async ({ ownerPage, ownerApi, project }) => {
    await ownerApi.addCard(project.id)
    const grid = new GridViewPage(ownerPage)
    await grid.open(project.id)

    await expect(grid.text(project.name)).toBeVisible()
    await expect(grid.savedIcon).toHaveCount(1)
    await expect(grid.tableViewLink).toBeVisible()

    await grid.tableViewLink.click()

    await expect(ownerPage).toHaveURL(`/projects/${project.id}`)
  })
})

test.describe('カードの表示', () => {
  test('カードを並び順の昇順にタイルで並べ、「表示項目1」「表示項目2」で選んだ内容と「カード入力」を表示する', spec(SPEC,
    'カードの表示 > カードを並び順の昇順に、タイルで並べて表示する',
    'カードの表示 > 各タイルに「表示項目1」「表示項目2」で選んだ内容と',
    'カードの表示 > 各タイルに「表示項目1」「表示項目2」で選んだ内容と > WHERE 選んだ内容が画像の場合',
    'カードの表示 > 各タイルに「表示項目1」「表示項目2」で選んだ内容と > WHERE 選んだ内容が ID の場合',
    'カードの表示 > 「表示項目1」「表示項目2」の選択欄を表示する > 初期値は',
  ), async ({ ownerPage, ownerApi, project }) => {
    const c1 = await ownerApi.addCard(project.id)
    const c2 = await ownerApi.addCard(project.id)
    const c3 = await ownerApi.addCard(project.id)
    await ownerApi.call('put', `/api/projects/${project.id}/cards`, [{ id: c1.id, order: 2 }, { id: c2.id, order: 3 }, { id: c3.id, order: 1 }])
    const firstImage = await addImageByApi(ownerPage, project.id, c1.id, 'red.png')
    await addImageByApi(ownerPage, project.id, c1.id, 'blue.png')
    const grid = new GridViewPage(ownerPage)
    await grid.open(project.id)

    await expect(grid.fieldSelect(1)).toHaveValue('image')
    await expect(grid.fieldSelect(2)).toHaveValue('id')
    await expect(grid.tiles).toHaveCount(3)
    // 並び順: c3, c1, c2
    await expect(grid.tile(0)).toContainText(`ID: ${c3.id}`)
    await expect(grid.tile(1)).toContainText(`ID: ${c1.id}`)
    await expect(grid.tile(2)).toContainText(`ID: ${c2.id}`)
    for (const i of [0, 1, 2]) await expect(grid.tileCardLink(i)).toBeVisible()
    // 1 枚目の画像を表示する（画像の無いカードには出ない）
    await expect(grid.tileImage(1)).toHaveCount(1)
    await expect(grid.tileImage(1)).toHaveAttribute('src', `/uploads/thumbs/${firstImage.filename}.webp`)
    await expect(grid.tileImage(0)).toHaveCount(0)
  })

  test('表示項目で項目を選ぶと、その項目の値を表示する', spec(SPEC,
    'カードの表示 > 各タイルに「表示項目1」「表示項目2」で選んだ内容と > WHERE 選んだ内容が項目の場合',
  ), async ({ ownerPage, ownerApi, project, tag }) => {
    await ownerApi.addCard(project.id, { みだし: `見出し${tag}`, メモ: `メモ${tag}` })
    const grid = new GridViewPage(ownerPage)
    await grid.open(project.id)

    await grid.fieldSelect(1).selectOption({ label: 'みだし' })
    await grid.fieldSelect(2).selectOption({ label: 'メモ' })

    await expect(grid.tile(0)).toContainText(`見出し${tag}`)
    await expect(grid.tile(0)).toContainText(`メモ${tag}`)
    await expect(grid.tile(0)).not.toContainText('ID:')
    await expect(grid.tileImage(0)).toHaveCount(0)
  })

  test('表示項目で選べるのは「画像」「ID」と、非表示の項目も含むすべての項目', spec(SPEC,
    'カードの表示 > 「表示項目1」「表示項目2」の選択欄を表示する',
    'カードの表示 > 「表示項目1」「表示項目2」の選択欄を表示する > 選べるのは',
  ), async ({ ownerPage, ownerApi, project }) => {
    const fields = await ownerApi.fields(project.id)
    await ownerApi.setFieldVisible(project.id, fields.find((f) => f.name === 'メモ')!.id, false)
    await ownerApi.addCard(project.id)
    const grid = new GridViewPage(ownerPage)
    await grid.open(project.id)

    for (const n of [1, 2] as const) {
      await expect(grid.fieldSelect(n).getByRole('option')).toHaveText(['画像', 'ID', 'みだし', 'メモ'])
    }
  })

  test('選んだ内容は同じプロジェクトの画面を移っても保持し、再読み込みすると初期値に戻る', spec(SPEC,
    'カードの表示 > 「表示項目1」「表示項目2」の選択欄を表示する > 選んだ内容は',
  ), async ({ ownerPage, ownerApi, project }) => {
    await ownerApi.addCard(project.id, { みだし: '見出しの値' })
    const grid = new GridViewPage(ownerPage)
    await grid.open(project.id)
    await grid.fieldSelect(1).selectOption({ label: 'みだし' })
    await grid.fieldSelect(2).selectOption({ label: '画像' })

    await grid.tableViewLink.click()
    await expect(ownerPage).toHaveURL(`/projects/${project.id}`)
    await ownerPage.getByRole('link', { name: 'グリッドビュー' }).click()
    await expect(ownerPage).toHaveURL(`/projects/${project.id}/grid`)

    await expect(grid.fieldSelect(1)).toHaveValue(String((await ownerApi.fields(project.id)).find((f) => f.name === 'みだし')!.id))
    await expect(grid.fieldSelect(2)).toHaveValue('image')
    await expect(grid.tile(0)).toContainText('見出しの値')

    await ownerPage.reload()
    await expect(grid.fieldSelect(1)).toHaveValue('image')
    await expect(grid.fieldSelect(2)).toHaveValue('id')
  })

  test('「カード入力」を押すと、そのカードのカード入力ビューに遷移する', spec(SPEC,
    'カードの表示 > WHEN 「カード入力」を押すと',
  ), async ({ ownerPage, ownerApi, project }) => {
    await ownerApi.addCard(project.id)
    const card = await ownerApi.addCard(project.id)
    const grid = new GridViewPage(ownerPage)
    await grid.open(project.id)

    await grid.tileCardLink(1).click()

    await expect(ownerPage).toHaveURL(`/projects/${project.id}/cards/${card.id}`)
    await expect(ownerPage.getByRole('button', { name: '画像を追加' })).toBeVisible()
  })
})

test.describe('並び替え', () => {
  test('タイルをドラッグして別の位置に置くと、表示どおりの順に並び順を 1 から振り直して保存する', spec(SPEC,
    '並び替え > WHEN タイルをドラッグして別の位置に置くと',
    'ヘッダー > プロジェクト名、「テーブルビュー」ボタン、保存状態のアイコンを表示する > 保存状態のアイコンは、並び替えの保存の状態を表す',
  ), async ({ ownerPage, ownerApi, project }) => {
    const c1 = await ownerApi.addCard(project.id)
    const c2 = await ownerApi.addCard(project.id)
    const c3 = await ownerApi.addCard(project.id)
    // 並び順を飛び飛びにしておく（1 から振り直すことを確かめる）
    await ownerApi.call('put', `/api/projects/${project.id}/cards`, [{ id: c1.id, order: 10 }, { id: c2.id, order: 20 }, { id: c3.id, order: 30 }])
    const grid = new GridViewPage(ownerPage)
    await grid.open(project.id)
    await expect(grid.savedIcon).toHaveCSS('opacity', '0')

    await grid.tile(0).dragTo(grid.tile(2))

    await expect(grid.savedIcon).toHaveCSS('opacity', '1')
    await expect(grid.tile(0)).toContainText(`ID: ${c2.id}`)
    await expect(grid.tile(1)).toContainText(`ID: ${c3.id}`)
    await expect(grid.tile(2)).toContainText(`ID: ${c1.id}`)
    const cards = await listCardsByApi(ownerPage, project.id)
    expect(cards.map((c) => [c.id, c.order])).toEqual([[c2.id, 1], [c3.id, 2], [c1.id, 3]])
  })
})

test.describe('選択', () => {
  test('タイルにマウスを乗せると選択のチェックボックスを表示する', spec(SPEC,
    '選択 > WHEN 各タイルにマウスを乗せると',
  ), async ({ ownerPage, ownerApi, project }) => {
    await ownerApi.addCard(project.id)
    await ownerApi.addCard(project.id)
    const grid = new GridViewPage(ownerPage)
    await grid.open(project.id)
    await ownerPage.mouse.move(0, 0)
    expect(await effectiveOpacity(grid.tileCheckbox(0))).toBe(0)

    await grid.tile(0).hover()

    await expect.poll(() => effectiveOpacity(grid.tileCheckbox(0))).toBe(1)
    expect(await effectiveOpacity(grid.tileCheckbox(1))).toBe(0)
  })

  test('タイルの「カード入力」以外を押すと選択を切り替え、選んでいる間はすべてのチェックボックスを表示し、選んだタイルに色を付ける', spec(SPEC,
    '選択 > WHEN 各タイルにマウスを乗せると > WHILE 1 件以上選んでいる間は',
    '選択 > WHEN タイルの「カード入力」以外の場所を押すと',
    '選択 > 選んだカードの一括操作は',
  ), async ({ ownerPage, ownerApi, project }) => {
    await ownerApi.addCard(project.id)
    await ownerApi.addCard(project.id)
    const grid = new GridViewPage(ownerPage)
    await grid.open(project.id)
    await expect(grid.tileHighlight(0)).toHaveCount(0)
    await expect(ownerPage.getByRole('button', { name: '0件選択中' })).toBeHidden()

    await grid.clickTile(0)
    await ownerPage.mouse.move(0, 0)

    await expect(grid.tileCheckbox(0)).toBeChecked()
    await expect(grid.tileCheckbox(1)).not.toBeChecked()
    await expect.poll(() => effectiveOpacity(grid.tileCheckbox(1))).toBe(1)
    await expect(grid.tileHighlight(0)).toBeVisible()
    await expect(grid.tileHighlight(1)).toHaveCount(0)
    await expect(ownerPage).toHaveURL(`/projects/${project.id}/grid`)
    // 選んだカードの一括操作（カードの選択と一括操作）のボタンを表示する
    await expect(ownerPage.getByRole('button', { name: '1件選択中' })).toBeVisible()

    await grid.clickTile(0)
    await ownerPage.mouse.move(0, 0)

    await expect(grid.tileCheckbox(0)).not.toBeChecked()
    await expect(grid.tileHighlight(0)).toHaveCount(0)
    await expect.poll(() => effectiveOpacity(grid.tileCheckbox(1))).toBe(0)
  })

  test('Shift キーを押しながら押すと、前に選んだタイルとの間をまとめて選び、まとめて外す', spec(SPEC,
    '選択 > WHILE Shift キーを押している間は',
  ), async ({ ownerPage, ownerApi, project }) => {
    for (let i = 0; i < 5; i++) await ownerApi.addCard(project.id)
    const grid = new GridViewPage(ownerPage)
    await grid.open(project.id)

    await grid.clickTile(1)
    await grid.clickTile(3, ['Shift'])

    for (const [i, checked] of [[0, false], [1, true], [2, true], [3, true], [4, false]] as const) {
      await expect(grid.tileCheckbox(i)).toBeChecked({ checked })
    }

    await grid.clickTile(2)
    await grid.clickTile(1, ['Shift'])

    // 2 を外した後、Shift で 1 を外すと、1〜2 をまとめて外す
    for (const [i, checked] of [[0, false], [1, false], [2, false], [3, true], [4, false]] as const) {
      await expect(grid.tileCheckbox(i)).toBeChecked({ checked })
    }
  })
})
