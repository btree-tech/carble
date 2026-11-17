import { expect, test } from '../../fixtures'
import { addImageByApi, effectiveOpacity, listCardsByApi } from '../../pages/CardViewPage'
import { CardSelection } from '../../pages/components/CardSelection'
import { DuplicateTargets } from '../../pages/components/DuplicateDialog'
import { GridViewPage } from '../../pages/GridViewPage'
import { TableViewPage } from '../../pages/TableViewPage'

const SPEC = 'pages/grid-view.md'

test.describe('ヘッダー', () => {
  test('プロジェクト名・「テーブルビュー」・保存状態のアイコンを表示し、「テーブルビュー」を押すとテーブルビューに遷移する', { tag: ['@TC-PG-GRID-HDR1', '@TC-PG-GRID-HDR2'] }, async ({ ownerPage, ownerApi, project }) => {
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
  test('カードを並び順の昇順にタイルで並べ、「表示項目1」「表示項目2」で選んだ内容と「カード入力」を表示する', { tag: ['@TC-PG-GRID-VIEW1', '@TC-PG-GRID-VIEW2', '@TC-PG-GRID-VIEW3', '@TC-PG-GRID-VIEW4', '@TC-PG-GRID-VIEW8'] }, async ({ ownerPage, ownerApi, project }) => {
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

  test('表示項目で項目を選ぶと、その項目の値を表示する', { tag: ['@TC-PG-GRID-VIEW5'] }, async ({ ownerPage, ownerApi, project, tag }) => {
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

  test('表示項目で選べるのは「画像」「ID」と、非表示の項目も含むすべての項目', { tag: ['@TC-PG-GRID-VIEW6', '@TC-PG-GRID-VIEW7'] }, async ({ ownerPage, ownerApi, project }) => {
    const fields = await ownerApi.fields(project.id)
    await ownerApi.setFieldVisible(project.id, fields.find((f) => f.name === 'メモ')!.id, false)
    await ownerApi.addCard(project.id)
    const grid = new GridViewPage(ownerPage)
    await grid.open(project.id)

    for (const n of [1, 2] as const) {
      await expect(grid.fieldSelect(n).getByRole('option')).toHaveText(['画像', 'ID', 'みだし', 'メモ'])
    }
  })

  test('選んだ内容は同じプロジェクトの画面を移っても保持し、再読み込みすると初期値に戻る', { tag: ['@TC-PG-GRID-VIEW9'] }, async ({ ownerPage, ownerApi, project }) => {
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

  test('「カード入力」を押すと、そのカードのカード入力ビューに遷移する', { tag: ['@TC-PG-GRID-VIEW10'] }, async ({ ownerPage, ownerApi, project }) => {
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
  test('タイルをドラッグして別の位置に置くと、表示どおりの順に並び順を 1 から振り直して保存する', { tag: ['@TC-PG-GRID-SORT1', '@TC-PG-GRID-HDR4'] }, async ({ ownerPage, ownerApi, project }) => {
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
  test('タイルにマウスを乗せると選択のチェックボックスを表示する', { tag: ['@TC-PG-GRID-SEL1'] }, async ({ ownerPage, ownerApi, project }) => {
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

  test('タイルの「カード入力」以外を押すと選択を切り替え、選んでいる間はすべてのチェックボックスを表示し、選んだタイルに色を付ける', { tag: ['@TC-PG-GRID-SEL2', '@TC-PG-GRID-SEL3', '@TC-PG-GRID-SEL5'] }, async ({ ownerPage, ownerApi, project }) => {
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

  test('Shift キーを押しながら押すと、前に選んだタイルとの間をまとめて選び、まとめて外す', { tag: ['@TC-PG-GRID-SEL4'] }, async ({ ownerPage, ownerApi, project }) => {
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

test.describe('ユーザーストーリー', () => {
  test('研究者がカードを画像付きのタイルで並べ、ドラッグで並び替えてから、まとめたいカードを選んで既存の別のプロジェクトに複製すると、複製先に並び替えた順で写真ごとカードができる', { tag: ['@story', '@TC-PG-GRID-US1'] }, async ({ ownerPage, ownerApi, project, tag }) => {
    const files = { 資料A: 'red.png', 資料B: 'blue.png', 資料C: 'green.png', 資料D: 'red.png' }
    const cards: Record<string, number> = {}
    for (const [name, file] of Object.entries(files)) {
      const card = await ownerApi.addCard(project.id, { みだし: name })
      await addImageByApi(ownerPage, project.id, card.id, file)
      cards[name] = card.id
    }
    // 「新しいプロジェクト」への複製は既知の問題（docs/ISSUES.md「新しいプロジェクトに複製するとプロジェクトを開けない」）があるため、作っておいた別のプロジェクトに複製する
    const target = await ownerApi.createProject(`再編先${tag}`)
    const grid = new GridViewPage(ownerPage)
    const selection = new CardSelection(ownerPage)
    await grid.open(project.id)

    // 画像と見出しのタイルで並べる
    await grid.fieldSelect(2).selectOption({ label: 'みだし' })
    await expect(grid.tiles).toHaveCount(4)
    for (const [i, name] of ['資料A', '資料B', '資料C', '資料D'].entries()) {
      await expect(grid.tile(i)).toContainText(name)
      await expect(grid.tileImage(i)).toHaveCount(1)
    }

    // ドラッグで並び替える（資料A を 3 番目へ）
    await grid.tile(0).dragTo(grid.tile(2))
    await expect(grid.savedIcon).toHaveCSS('opacity', '1')
    for (const [i, name] of ['資料B', '資料C', '資料A', '資料D'].entries()) await expect(grid.tile(i)).toContainText(name)
    await expect.poll(async () => (await listCardsByApi(ownerPage, project.id)).map((c) => c.id))
      .toEqual([cards.資料B, cards.資料C, cards.資料A, cards.資料D])

    // 並び替えた先頭の 3 枚を選び、別のプロジェクトに複製する
    await grid.clickTile(0)
    await grid.clickTile(2, ['Shift'])
    await expect(selection.countButton).toHaveText('3件選択中')
    await selection.duplicateButton.click()
    await DuplicateTargets.popover(ownerPage).project(target.name).click()

    await expect(ownerPage.getByText('複製しました', { exact: true })).toBeVisible()
    await expect(ownerPage).toHaveURL(`/projects/${target.id}`)

    // 複製先のグリッドビューに、並び替えた順で写真ごと並ぶ
    await new TableViewPage(ownerPage).gridViewLink.click()
    await expect(ownerPage).toHaveURL(`/projects/${target.id}/grid`)
    await grid.fieldSelect(2).selectOption({ label: 'みだし' })
    await expect(grid.tiles).toHaveCount(3)
    for (const [i, name] of ['資料B', '資料C', '資料A'].entries()) {
      await expect(grid.tile(i)).toContainText(name)
      await expect(grid.tileImage(i)).toHaveCount(1)
    }
    const duplicated = await listCardsByApi(ownerPage, target.id)
    expect(duplicated.map((c) => c.images.length)).toEqual([1, 1, 1])

    // 複製元のカードは、並び替えた順のまま残る
    expect((await listCardsByApi(ownerPage, project.id)).map((c) => c.id)).toEqual([cards.資料B, cards.資料C, cards.資料A, cards.資料D])
  })
})
