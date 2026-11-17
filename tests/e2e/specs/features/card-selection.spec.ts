import { expect, test } from '../../fixtures'
import { CardMenu } from '../../pages/components/CardMenu'
import { CardSelection, GridSelection } from '../../pages/components/CardSelection'
import { DuplicateTargets } from '../../pages/components/DuplicateDialog'
import { dragWithMouse, TableViewPage } from '../../pages/TableViewPage'
import { knownIssue } from '../../support/spec'

const SPEC = 'features/card-selection.md'

test.describe('選択', () => {
  test('テーブルビューのカードごとと見出しに、グリッドビューのカードごとに、選択のチェックボックスを表示する', { tag: ['@TC-FT-SELECT-SEL1', '@TC-FT-SELECT-SEL2', '@TC-PG-TABLE-LIST10'] }, async ({ ownerPage, ownerApi, project }) => {
    for (const v of ['a', 'b', 'c']) await ownerApi.addCard(project.id, { みだし: v })
    const tv = new TableViewPage(ownerPage)
    await tv.open(project.id)
    for (const id of [1, 2, 3]) await expect(tv.checkbox(id)).not.toBeChecked()
    await expect(tv.headerCheckbox).not.toBeChecked()

    const grid = new GridSelection(ownerPage)
    await grid.open(project.id)
    for (const id of [1, 2, 3]) await expect(grid.checkbox(id)).not.toBeChecked()
  })

  test('見出しのチェックボックスを選ぶと、表示しているすべてのカードを選ぶ', { tag: ['@TC-FT-SELECT-SEL3'] }, async ({ ownerPage, ownerApi, project }) => {
    for (const v of ['apple', 'banana', 'apricot']) await ownerApi.addCard(project.id, { みだし: v })
    const tv = new TableViewPage(ownerPage)
    const selection = new CardSelection(ownerPage)
    await tv.open(project.id)
    await tv.search('ap')
    await expect(tv.idCells).toHaveText(['1', '3'])

    await tv.headerCheckbox.check()
    await expect(tv.checkbox(1)).toBeChecked()
    await expect(tv.checkbox(3)).toBeChecked()
    await expect(selection.countButton).toHaveText('2件選択中')
    await expect(tv.headerCheckbox).toBeChecked({ indeterminate: false })
  })

  test('一部のカードだけを選んでいる間は見出しを「一部選択」にし、見出しを押すと選択をすべて外す', { tag: ['@TC-FT-SELECT-SEL5', '@TC-FT-SELECT-SEL4'] }, async ({ ownerPage, ownerApi, project }) => {
    for (const v of ['a', 'b', 'c']) await ownerApi.addCard(project.id, { みだし: v })
    const tv = new TableViewPage(ownerPage)
    const selection = new CardSelection(ownerPage)
    await tv.open(project.id)

    await tv.checkbox(2).check()
    await expect(tv.headerCheckbox).toBeChecked({ indeterminate: true })
    await tv.checkbox(1).check()
    await expect(tv.headerCheckbox).toBeChecked({ indeterminate: true })
    await tv.checkbox(3).check()
    await expect(tv.headerCheckbox).toBeChecked({ indeterminate: false })
    await tv.checkbox(3).uncheck()
    await expect(tv.headerCheckbox).toBeChecked({ indeterminate: true })

    await tv.headerCheckbox.click()
    for (const id of [1, 2, 3]) await expect(tv.checkbox(id)).not.toBeChecked()
    await expect(tv.headerCheckbox).not.toBeChecked()
    await expect(selection.countButton).toBeHidden()
  })

  test('テーブルビューで別の画面に移るか、カードの一覧が変わる（追加・複製・削除・並び替え・検索）と、選択を外す', { tag: ['@TC-FT-SELECT-SEL6'] }, async ({ ownerPage, ownerApi, project }) => {
    for (const v of ['a', 'b', 'c']) await ownerApi.addCard(project.id, { みだし: v })
    const tv = new TableViewPage(ownerPage)
    const selection = new CardSelection(ownerPage)
    await tv.open(project.id)

    const selectCard1 = async () => {
      await tv.checkbox(1).check()
      await expect(selection.countButton).toHaveText('1件選択中')
    }
    const expectCleared = async () => {
      await expect(selection.countButton).toBeHidden()
      await expect(tv.checkbox(1)).not.toBeChecked()
    }

    // 別の画面（グリッドビュー）に移って戻る
    await selectCard1()
    await tv.gridViewLink.click()
    await expect(ownerPage).toHaveURL(`/projects/${project.id}/grid`)
    await new GridSelection(ownerPage).tableViewLink.click()
    await expect(ownerPage).toHaveURL(`/projects/${project.id}`)
    await expectCleared()

    // 追加
    await selectCard1()
    await tv.addButton.click()
    await expect(tv.idCells).toHaveText(['1', '2', '3', '4'])
    await expectCleared()

    // 複製
    await selectCard1()
    await new CardMenu(ownerPage, tv.cardMenuButton(2)).choose('末尾に複製')
    await expect(tv.idCells).toHaveText(['1', '2', '3', '4', '5'])
    await expectCleared()

    // 削除
    await selectCard1()
    ownerPage.once('dialog', (dialog) => void dialog.accept())
    await new CardMenu(ownerPage, tv.cardMenuButton(5)).choose('削除')
    await expect(tv.idCells).toHaveText(['1', '2', '3', '4'])
    await expectCleared()

    // 並び替え
    await selectCard1()
    await tv.sortLink('ID').click()
    await expect(ownerPage).toHaveURL(/sort=id/)
    await expectCleared()

    // 検索
    await selectCard1()
    await tv.search('a')
    await expect(tv.idCells).toHaveText(['1'])
    await expectCleared()
  })

  test('グリッドビューでは、別の画面に移っても選択を保つ', { tag: ['@TC-FT-SELECT-SEL7'] }, async ({ ownerPage, ownerApi, project }) => {
    for (const v of ['a', 'b', 'c']) await ownerApi.addCard(project.id, { みだし: v })
    const grid = new GridSelection(ownerPage)
    const selection = new CardSelection(ownerPage)
    await grid.open(project.id)

    await grid.checkbox(1).check()
    await grid.checkbox(3).check()
    await expect(selection.countButton).toHaveText('2件選択中')

    // テーブルビューに移る（テーブルビューの選択は別）
    await grid.tableViewLink.click()
    await expect(ownerPage).toHaveURL(`/projects/${project.id}`)
    const tv = new TableViewPage(ownerPage)
    await expect(tv.checkbox(1)).not.toBeChecked()
    await expect(selection.countButton).toBeHidden()

    // グリッドビューに戻ると、選択が残っている
    await tv.gridViewLink.click()
    await expect(selection.countButton).toHaveText('2件選択中')
    await expect(grid.checkbox(1)).toBeChecked()
    await expect(grid.checkbox(2)).not.toBeChecked()
    await expect(grid.checkbox(3)).toBeChecked()
  })

  test('グリッドビューでカードの一覧が変わると、一覧から無くなったカードだけを選択から外す', { tag: ['@TC-FT-SELECT-SEL8'] }, async ({ ownerPage, ownerApi, project }) => {
    for (const v of ['a', 'b', 'c']) await ownerApi.addCard(project.id, { みだし: v })
    const grid = new GridSelection(ownerPage)
    const selection = new CardSelection(ownerPage)
    await grid.open(project.id)
    await grid.checkbox(1).check()
    await grid.checkbox(3).check()
    await expect(selection.countButton).toHaveText('2件選択中')

    // 並び替えで一覧が変わっても、無くなったカードが無ければ選択を保つ
    const saved = ownerPage.waitForResponse((r) => r.request().method() === 'PUT' && r.url().endsWith(`/api/projects/${project.id}/cards`))
    await dragWithMouse(ownerPage, grid.card(2), grid.card(1), 'horizontal')
    await saved
    await expect(selection.countButton).toHaveText('2件選択中')
    await expect(grid.checkbox(1)).toBeChecked()
    await expect(grid.checkbox(2)).not.toBeChecked()
    await expect(grid.checkbox(3)).toBeChecked()

    // 選んだカードを削除すると、無くなったカードを選択から外す（残ったカード 2 は選ばれないまま）
    ownerPage.once('dialog', (dialog) => void dialog.accept())
    await selection.deleteButton.click()
    await expect(grid.card(1)).toHaveCount(0)
    await expect(grid.card(3)).toHaveCount(0)
    await expect(selection.countButton).toBeHidden()
    await expect(grid.checkbox(2)).not.toBeChecked()
  })

  test('【実装との乖離】グリッドビューで選んだカードをテーブルビューで削除して戻ると、無くなったカードが選択に残る（あるべき: 一覧から無くなったカードを選択から外す）', { annotation: [knownIssue(SPEC, 'グリッドビューで選んだカードを、ほかの画面で削除してからグリッドビューに戻ると、削除したカードが選択に残ったままになる')] }, async ({ ownerPage, ownerApi, project }) => {
    for (const v of ['a', 'b', 'c']) await ownerApi.addCard(project.id, { みだし: v })
    const grid = new GridSelection(ownerPage)
    const selection = new CardSelection(ownerPage)
    await grid.open(project.id)
    await grid.checkbox(1).check()
    await grid.checkbox(2).check()
    await expect(selection.countButton).toHaveText('2件選択中')

    // テーブルビューで、選んでいたカード 1 を削除してから戻る
    await grid.tableViewLink.click()
    const tv = new TableViewPage(ownerPage)
    ownerPage.once('dialog', (dialog) => void dialog.accept())
    await new CardMenu(ownerPage, tv.cardMenuButton(1)).choose('削除')
    await expect(tv.idCells).toHaveText(['2', '3'])
    await tv.gridViewLink.click()

    await expect(grid.card(1)).toHaveCount(0)
    await expect(grid.checkbox(2)).toBeChecked()
    // 削除したカード 1 も数に入ったまま
    await expect(selection.countButton).toHaveText('2件選択中')
  })
})

test.describe('一括操作', () => {
  test('1 件以上選んでいる間は「（件数）件選択中」「複製」「削除」を表示し、「（件数）件選択中」を押すと選択をすべて外す', { tag: ['@TC-FT-SELECT-BULK1', '@TC-FT-SELECT-BULK2'] }, async ({ ownerPage, ownerApi, project }) => {
    for (const v of ['a', 'b', 'c']) await ownerApi.addCard(project.id, { みだし: v })
    const tv = new TableViewPage(ownerPage)
    const selection = new CardSelection(ownerPage)
    await tv.open(project.id)
    await expect(selection.countButton).toBeHidden()
    await expect(selection.duplicateButton).toBeHidden()
    await expect(selection.deleteButton).toBeHidden()

    await tv.checkbox(1).check()
    await tv.checkbox(3).check()
    await expect(selection.countButton).toHaveText('2件選択中')
    await expect(selection.duplicateButton).toBeVisible()
    await expect(selection.deleteButton).toBeVisible()

    await selection.countButton.click()
    await expect(tv.checkbox(1)).not.toBeChecked()
    await expect(tv.checkbox(3)).not.toBeChecked()
    await expect(selection.countButton).toBeHidden()
    await expect(selection.duplicateButton).toBeHidden()
    await expect(selection.deleteButton).toBeHidden()
  })

  test('「複製」で、今のプロジェクトを除いた複製先の一覧を開き、プロジェクトを選ぶと、選んだカードをその末尾に複製して「複製しました」と表示し、そのテーブルビューに遷移する', { tag: ['@TC-FT-SELECT-BULK3', '@TC-FT-SELECT-BULK4', '@TC-FT-SELECT-BULK5', '@TC-FT-DUP-CONT8', '@TC-FT-DUP-AFTR6'] }, async ({ ownerPage, ownerApi, project, tag }) => {
    await ownerApi.addCard(project.id, { みだし: 'one' })
    await ownerApi.addCard(project.id, { みだし: 'two' })
    await ownerApi.addCard(project.id, { みだし: 'three' })
    const target = await ownerApi.createProject(`複製先${tag}`)
    await ownerApi.addCard(target.id, { みだし: 'existing' })

    const tv = new TableViewPage(ownerPage)
    const selection = new CardSelection(ownerPage)
    await tv.open(project.id)
    // 選んだ順（3, 1）ではなく、元の並び順（1, 3）に置く
    await tv.checkbox(3).check()
    await tv.checkbox(1).check()
    await selection.duplicateButton.click()

    const targets = DuplicateTargets.popover(ownerPage)
    await expect(targets.project(target.name)).toBeVisible()
    await expect(targets.project(project.name)).toHaveCount(0)
    await expect(targets.newProject).toBeVisible()

    await targets.project(target.name).click()
    await expect(tv.toast('複製しました')).toBeVisible()
    await expect(ownerPage).toHaveURL(`/projects/${target.id}`)
    await expect(tv.idCells).toHaveText(['1', '2', '3'])
    await expect(await tv.cellInput(1, 'みだし')).toHaveValue('existing')
    await expect(await tv.cellInput(2, 'みだし')).toHaveValue('one')
    await expect(await tv.cellInput(3, 'みだし')).toHaveValue('three')
  })

  test('【既知の問題】「新しいプロジェクト」を選ぶと、遷移した先のカード入力ビューが何も表示しない（あるべき: 新しいプロジェクトに複製し、最初のカードのカード入力ビューを表示する）', {
    annotation: [
      knownIssue('docs/ISSUES.md', '新しいプロジェクトに複製するとプロジェクトを開けない'),
      knownIssue(SPEC, '「新しいプロジェクト」に複製すると、作ったプロジェクトにオーナーが設定されず、遷移した先でプロジェクトを開けない'),
    ],
  }, async ({ ownerPage, ownerApi, project }) => {
    await ownerApi.addCard(project.id, { みだし: 'one' })
    await ownerApi.addCard(project.id, { みだし: 'two' })
    const tv = new TableViewPage(ownerPage)
    const selection = new CardSelection(ownerPage)
    await tv.open(project.id)
    await tv.checkbox(1).check()
    await tv.checkbox(2).check()
    await selection.duplicateButton.click()

    const notFound = ownerPage.waitForResponse((r) => /\/api\/projects\/\d+$/.test(r.url()) && r.status() === 404)
    await DuplicateTargets.popover(ownerPage).newProject.click()
    await expect(tv.toast('複製しました')).toBeVisible()
    // 新しいプロジェクトの、複製した最初のカード（ID 1）のカード入力ビューに遷移するが、プロジェクトを読めず（404）、何も表示しない
    await expect(ownerPage).toHaveURL((url) => /^\/projects\/\d+\/cards\/1$/.test(url.pathname) && !url.pathname.startsWith(`/projects/${project.id}/`))
    await notFound
    // エラー画面でもなく、リンクも入力欄も無い空の画面になる
    await expect(ownerPage.getByRole('link')).toHaveCount(0)
    await expect(ownerPage.getByRole('textbox')).toHaveCount(0)

    // 作ったプロジェクトは、複製元のカードの「複製先カードを表示」に「無題のプロジェクト」として出る
    await tv.open(project.id)
    await new CardMenu(ownerPage, tv.cardMenuButton(1)).choose('複製先カードを表示')
    await expect(ownerPage.getByRole('dialog').getByRole('link', { name: '無題のプロジェクト - ID: 1' })).toBeVisible()
  })

  test('「削除」で確認し、確認すると選んだカードすべてを削除する', { tag: ['@TC-FT-SELECT-BULK7', '@TC-FT-SELECT-BULK8'] }, async ({ ownerPage, ownerApi, project }) => {
    for (const v of ['a', 'b', 'c']) await ownerApi.addCard(project.id, { みだし: v })
    const tv = new TableViewPage(ownerPage)
    const selection = new CardSelection(ownerPage)
    await tv.open(project.id)
    await tv.checkbox(1).check()
    await tv.checkbox(2).check()

    const messages: string[] = []
    ownerPage.once('dialog', (dialog) => {
      messages.push(dialog.message())
      void dialog.dismiss()
    })
    await selection.deleteButton.click()
    await expect.poll(() => messages).toEqual(['削除してよろしいですか？'])
    await expect(tv.idCells).toHaveText(['1', '2', '3'])
    await expect(selection.countButton).toHaveText('2件選択中')

    ownerPage.once('dialog', (dialog) => {
      messages.push(dialog.message())
      void dialog.accept()
    })
    await selection.deleteButton.click()
    await expect(tv.idCells).toHaveText(['3'])
    await expect(selection.countButton).toBeHidden()
    expect(messages).toEqual(['削除してよろしいですか？', '削除してよろしいですか？'])
  })

  test('【実装との乖離】一括削除では「削除しました」と表示しない（あるべき: 完了メッセージを表示する）', { annotation: [knownIssue(SPEC, '一括削除では、完了メッセージ（「削除しました」）を表示しない')] }, async ({ ownerPage, ownerApi, project }) => {
    for (const v of ['a', 'b']) await ownerApi.addCard(project.id, { みだし: v })
    const tv = new TableViewPage(ownerPage)
    const selection = new CardSelection(ownerPage)
    await tv.open(project.id)
    await tv.checkbox(1).check()

    ownerPage.once('dialog', (dialog) => void dialog.accept())
    await selection.deleteButton.click()
    await expect(tv.idCells).toHaveText(['2'])
    await expect(tv.toast('削除しました')).toHaveCount(0)
  })
})

test.describe('ユーザーストーリー', () => {
  test('研究者が、絞り込んだカードをまとめて選んで別のプロジェクトへ複製し、元のプロジェクトでは不要なカードをまとめて選んで削除して、カード群を整理する', { tag: ['@story', '@TC-FT-SELECT-US1'] }, async ({ ownerPage, ownerApi, project, tag }) => {
    await ownerApi.addCard(project.id, { みだし: 'A-土器', メモ: 'A区' })
    await ownerApi.addCard(project.id, { みだし: 'B-石器', メモ: '不要' })
    await ownerApi.addCard(project.id, { みだし: 'A-骨片', メモ: 'A区' })
    await ownerApi.addCard(project.id, { みだし: 'B-土器', メモ: '不要' })
    await ownerApi.addCard(project.id, { みだし: 'A-木片', メモ: 'A区' })
    const target = await ownerApi.createProject(`A区のまとめ${tag}`)
    await ownerApi.addCard(target.id, { みだし: '既存のカード' })

    const tv = new TableViewPage(ownerPage)
    const selection = new CardSelection(ownerPage)
    await tv.open(project.id)

    // 「A-」で絞り込み、見出しのチェックボックスで表示しているカードをまとめて選ぶ
    await tv.search('A-')
    await expect(tv.idCells).toHaveText(['1', '3', '5'])
    await tv.headerCheckbox.check()
    await expect(selection.countButton).toHaveText('3件選択中')

    // まとめて別のプロジェクトへ複製する
    await selection.duplicateButton.click()
    await DuplicateTargets.popover(ownerPage).project(target.name).click()
    await expect(tv.toast('複製しました')).toBeVisible()
    await expect(ownerPage).toHaveURL(`/projects/${target.id}`)
    await expect(tv.idCells).toHaveText(['1', '2', '3', '4'])
    await expect(await tv.cellInput(2, 'みだし')).toHaveValue('A-土器')
    await expect(await tv.cellInput(3, 'みだし')).toHaveValue('A-骨片')
    await expect(await tv.cellInput(4, 'みだし')).toHaveValue('A-木片')

    // 元のプロジェクトに戻り、不要なカードを 1 枚ずつ選んで、まとめて削除する
    await tv.open(project.id)
    await expect(tv.idCells).toHaveText(['1', '2', '3', '4', '5'])
    await tv.checkbox(2).check()
    await tv.checkbox(4).check()
    await expect(selection.countButton).toHaveText('2件選択中')
    ownerPage.once('dialog', (dialog) => void dialog.accept())
    await selection.deleteButton.click()
    await expect(tv.idCells).toHaveText(['1', '3', '5'])
    await expect(selection.countButton).toBeHidden()

    // 開き直しても、整理した結果が残っている
    await tv.open(project.id)
    await expect(tv.idCells).toHaveText(['1', '3', '5'])
    await expect(tv.countText).toHaveText('全 3 件')
    await tv.open(target.id)
    await expect(tv.countText).toHaveText('全 4 件')
    await expect(await tv.cellInput(1, 'みだし')).toHaveValue('既存のカード')
    await expect(await tv.cellInput(4, 'メモ')).toHaveValue('A区')
  })
})
