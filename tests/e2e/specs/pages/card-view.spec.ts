import { expect, test } from '../../fixtures'
import { addImageByApi, cardFile, CardViewPage, effectiveOpacity, getCardByApi, listCardsByApi } from '../../pages/CardViewPage'
import { PrintViewPage } from '../../pages/PrintViewPage'
import { knownIssue, spec, withIssue } from '../../support/spec'

const SPEC = 'pages/card-view.md'

test.describe('ヘッダー', () => {
  test('プロジェクト名・「スキャン」・「テーブルビュー」・「カード印刷ビュー」・保存状態のアイコン・メニュー「…」を表示する', spec(SPEC,
    'ヘッダー > プロジェクト名と「スキャン」ボタンを表示する',
    'ヘッダー > 「テーブルビュー」「カード印刷ビュー」ボタン、保存状態のアイコン',
  ), async ({ ownerPage, ownerApi, project }) => {
    const card = await ownerApi.addCard(project.id)
    const view = new CardViewPage(ownerPage)
    await view.open(project.id, card.id)

    await expect(view.text(project.name)).toBeVisible()
    await expect(view.scanButton).toBeVisible()
    await expect(view.tableViewLink).toBeVisible()
    await expect(view.printViewLink).toBeVisible()
    // 保存状態のアイコンは、保存するまで透明で置いてある
    await expect(view.savedIcon).toHaveCount(1)
    await expect(view.menuButton).toBeVisible()
  })

  test('「テーブルビュー」を押すと、並び替えと検索の条件を引き継いでテーブルビューに遷移する', spec(SPEC,
    'ヘッダー > 「テーブルビュー」「カード印刷ビュー」ボタン、保存状態のアイコン > WHEN 「テーブルビュー」を押す',
  ), async ({ ownerPage, ownerApi, project, tag }) => {
    const card = await ownerApi.addCard(project.id, { みだし: `りんご${tag}` })
    const view = new CardViewPage(ownerPage)
    await view.open(project.id, card.id, `q=りんご${tag}&sort=id&direction=desc`)

    await view.tableViewLink.click()

    await expect(ownerPage).toHaveURL(new RegExp(`/projects/${project.id}\\?`))
    const url = new URL(ownerPage.url())
    expect(url.pathname).toBe(`/projects/${project.id}`)
    expect(url.searchParams.get('q')).toBe(`りんご${tag}`)
    expect(url.searchParams.get('sort')).toBe('id')
    expect(url.searchParams.get('direction')).toBe('desc')
  })

  test('「カード印刷ビュー」を押すと、条件を引き継いでこのカードだけのカード印刷ビューに遷移する', spec(SPEC,
    'ヘッダー > 「テーブルビュー」「カード印刷ビュー」ボタン、保存状態のアイコン > WHEN 「カード印刷ビュー」を押す',
  ), async ({ ownerPage, ownerApi, project, tag }) => {
    await ownerApi.addCard(project.id, { みだし: `前のカード${tag}` })
    const card = await ownerApi.addCard(project.id, { みだし: `印刷するカード${tag}` })
    await ownerApi.addCard(project.id, { みだし: `後のカード${tag}` })
    const view = new CardViewPage(ownerPage)
    await view.open(project.id, card.id, 'q=&sort=id&direction=desc')

    await view.printViewLink.click()

    await expect(ownerPage).toHaveURL(new RegExp(`/projects/${project.id}/cards/${card.id}/print\\?`))
    const url = new URL(ownerPage.url())
    expect(url.searchParams.get('sort')).toBe('id')
    expect(url.searchParams.get('direction')).toBe('desc')
    const print = new PrintViewPage(ownerPage)
    await expect(print.cards).toHaveCount(1)
    await expect(print.card()).toContainText(`印刷するカード${tag}`)
  })

  test('保存状態のアイコンは、項目の値を保存すると保存済みの印を表示する', spec(SPEC,
    'ヘッダー > 「テーブルビュー」「カード印刷ビュー」ボタン、保存状態のアイコン > 保存状態のアイコンは、項目の値の保存の状態を表す',
  ), async ({ ownerPage, ownerApi, project }) => {
    const card = await ownerApi.addCard(project.id)
    const view = new CardViewPage(ownerPage)
    await view.open(project.id, card.id)
    await expect(view.savedIcon).toHaveCSS('opacity', '0')

    await view.field('みだし').fill('保存する値')

    await expect(view.savedIcon).toHaveCSS('opacity', '1')
  })
})

test.describe('カードの内容', () => {
  test('項目と画像を左右に並べて表示する', spec(SPEC,
    'カードの内容 > 項目と画像を左右に並べて表示する',
  ), async ({ ownerPage, ownerApi, project }) => {
    const card = await ownerApi.addCard(project.id)
    await addImageByApi(ownerPage, project.id, card.id)
    const view = new CardViewPage(ownerPage)
    await view.open(project.id, card.id)

    const field = (await view.field('みだし').boundingBox())!
    const image = (await view.images.first().boundingBox())!
    expect(image.x).toBeGreaterThanOrEqual(field.x + field.width)
    expect(image.y).toBeLessThan(field.y + field.height)
  })

  test('「ID」「並び順」として、カードの ID と並び順を表示する', spec(SPEC,
    'カードの内容 > 「ID」「並び順」として、カードの ID と並び順を表示する',
  ), async ({ ownerPage, ownerApi, project }) => {
    const other = await ownerApi.addCard(project.id)
    const card = await ownerApi.addCard(project.id)
    await ownerApi.call('put', `/api/projects/${project.id}/cards`, [{ id: other.id, order: 1 }, { id: card.id, order: 5 }])
    const view = new CardViewPage(ownerPage)
    await view.open(project.id, card.id)

    await expect(view.idValue).toHaveText(`ID${card.id}`)
    await expect(view.orderValue).toHaveText('並び順5')
  })

  test('表示している項目ごとに項目名と値の入力欄を表示し、非表示の項目は表示しない', spec(SPEC,
    'カードの内容 > 表示している項目ごとに、項目名と値の入力欄を表示する',
    'カードの内容 > 表示している項目ごとに、項目名と値の入力欄を表示する > WHERE 項目を非表示にしている',
  ), async ({ ownerPage, ownerApi, project }) => {
    const hidden = await ownerApi.addField(project.id, '非表示の項目')
    await ownerApi.setFieldVisible(project.id, hidden.id, false)
    const card = await ownerApi.addCard(project.id, { みだし: '見出しの値', メモ: 'メモの値', 非表示の項目: '隠した値' })
    const view = new CardViewPage(ownerPage)
    await view.open(project.id, card.id)

    await expect(view.field('みだし')).toHaveValue('見出しの値')
    await expect(view.field('メモ')).toHaveValue('メモの値')
    await expect(view.fieldInputs).toHaveCount(2)
    await expect(view.text('非表示の項目')).toHaveCount(0)
  })

  test('値を変更すると、入力が止まってから 1 秒後に保存する', spec(SPEC,
    'カードの内容 > 表示している項目ごとに、項目名と値の入力欄を表示する > WHEN 値を変更すると',
  ), async ({ ownerPage, ownerApi, project }) => {
    const card = await ownerApi.addCard(project.id)
    const view = new CardViewPage(ownerPage)
    await view.open(project.id, card.id)
    const saves: number[] = []
    ownerPage.on('request', (request) => {
      if (request.method() === 'PUT' && request.url().includes(`/cards/${card.id}/fields/`)) saves.push(Date.now())
    })

    // 1 秒より短い間隔で打ち続ける間は保存しない
    await view.field('みだし').pressSequentially('あいう', { delay: 400 })
    const typedAt = Date.now()
    await expect(view.savedIcon).toHaveCSS('opacity', '1')

    // 同じ画面に隠れているテーブルビューも同じ値を保存するため、保存の要求は 2 つ出ることがある（どちらも入力が止まってから）
    expect(saves.length).toBeGreaterThanOrEqual(1)
    for (const savedAt of saves) expect(savedAt - typedAt).toBeGreaterThanOrEqual(900)
    await ownerPage.reload()
    await expect(view.field('みだし')).toHaveValue('あいう')
  })

  test('項目の下の「＋」を押すと「新しい項目を追加」を開き、項目名を入れて「追加」を押すと末尾に追加して閉じる', spec(SPEC,
    'カードの内容 > 項目の下に「＋」ボタンを表示する',
    'カードの内容 > WHEN 「＋」を押すと',
    'カードの内容 > WHEN 「＋」を押すと > WHEN 項目名を入れて「追加」を押す',
    'カードの内容 > WHEN 「＋」を押すと > WHILE 項目名が空の間は',
  ), async ({ ownerPage, ownerApi, project, tag }) => {
    const card = await ownerApi.addCard(project.id)
    const view = new CardViewPage(ownerPage)
    await view.open(project.id, card.id)
    const plus = (await view.addFieldButton.boundingBox())!
    const lastField = (await view.field('メモ').boundingBox())!
    expect(plus.y).toBeGreaterThan(lastField.y)

    await view.addFieldButton.click()

    await expect(view.newFieldInput).toBeVisible()
    await expect(view.newFieldInput).toHaveAttribute('placeholder', '項目名')
    await expect(view.newFieldSubmit).toBeDisabled()

    await view.newFieldInput.fill(`追加した項目${tag}`)
    await expect(view.newFieldSubmit).toBeEnabled()
    await view.newFieldSubmit.click()

    await expect(view.newFieldInput).toBeHidden()
    await expect(view.field(`追加した項目${tag}`)).toBeVisible()
    await expect(view.fieldInputs.last()).toHaveAccessibleName(`追加した項目${tag}`)
    expect((await ownerApi.fields(project.id)).map((f) => f.name)).toEqual(['みだし', 'メモ', `追加した項目${tag}`])
  })
})

test.describe('画像', () => {
  test('カードの画像を、追加した順に縮小して表示する', spec(SPEC,
    '画像 > カードの画像を、追加した順に縮小して表示する',
  ), async ({ ownerPage, ownerApi, project }) => {
    const card = await ownerApi.addCard(project.id)
    const first = await addImageByApi(ownerPage, project.id, card.id, 'red.png')
    const second = await addImageByApi(ownerPage, project.id, card.id, 'blue.png')
    const view = new CardViewPage(ownerPage)
    await view.open(project.id, card.id)

    await expect(view.images).toHaveCount(2)
    await expect(view.images.nth(0)).toHaveAttribute('src', `/uploads/thumbs/${first.filename}.webp`)
    await expect(view.images.nth(1)).toHaveAttribute('src', `/uploads/thumbs/${second.filename}.webp`)
  })

  test('画像にマウスを乗せると「元の画像を表示」「画像を削除」を表示する', spec(SPEC,
    '画像 > WHEN 画像にマウスを乗せると',
  ), async ({ ownerPage, ownerApi, project }) => {
    const card = await ownerApi.addCard(project.id)
    await addImageByApi(ownerPage, project.id, card.id)
    const view = new CardViewPage(ownerPage)
    await view.open(project.id, card.id)
    await ownerPage.mouse.move(0, 0)

    expect(await effectiveOpacity(view.showOriginalLinks.first())).toBe(0)
    expect(await effectiveOpacity(view.removeImageButtons.first())).toBe(0)

    await view.images.first().scrollIntoViewIfNeeded() // 縮小画像の読み込みで位置がずれ、表示の外に出ていることがある
    await view.images.first().hover({ force: true }) // 画像の上に操作ボタンの層が重なっていて、hover の判定を受け止めるため

    await expect.poll(() => effectiveOpacity(view.showOriginalLinks.first())).toBe(1)
    await expect.poll(() => effectiveOpacity(view.removeImageButtons.first())).toBe(1)
  })

  test('「元の画像を表示」を押すと、元の大きさの画像を別のタブで開く', spec(SPEC,
    '画像 > WHEN 画像にマウスを乗せると > WHEN 「元の画像を表示」を押す',
  ), async ({ ownerPage, ownerApi, project }) => {
    const card = await ownerApi.addCard(project.id)
    const image = await addImageByApi(ownerPage, project.id, card.id, 'red.png')
    const view = new CardViewPage(ownerPage)
    await view.open(project.id, card.id)
    await view.images.first().scrollIntoViewIfNeeded() // 縮小画像の読み込みで位置がずれ、表示の外に出ていることがある
    await view.images.first().hover({ force: true }) // 画像の上に操作ボタンの層が重なっていて、hover の判定を受け止めるため

    const popupPromise = ownerPage.waitForEvent('popup')
    await view.showOriginalLinks.first().click()
    const popup = await popupPromise

    await expect(popup).toHaveURL(new RegExp(`/uploads/images/${image.filename}$`))
    // red.png は 640×480
    await expect.poll(() => popup.evaluate(() => {
      const img = document.querySelector('img')
      return img ? `${img.naturalWidth}x${img.naturalHeight}` : ''
    })).toBe('640x480')
    await expect(ownerPage).toHaveURL(new RegExp(`/cards/${card.id}$`))
  })

  test('「画像を削除」を押すと、確認せずに画像を削除する', spec(SPEC,
    '画像 > WHEN 画像にマウスを乗せると > WHEN 「画像を削除」を押す',
  ), async ({ ownerPage, ownerApi, project }) => {
    const card = await ownerApi.addCard(project.id)
    await addImageByApi(ownerPage, project.id, card.id, 'red.png')
    const view = new CardViewPage(ownerPage)
    await view.open(project.id, card.id)
    const dialogs: string[] = []
    ownerPage.on('dialog', async (dialog) => {
      dialogs.push(dialog.message())
      await dialog.dismiss()
    })

    await view.images.first().scrollIntoViewIfNeeded() // 縮小画像の読み込みで位置がずれ、表示の外に出ていることがある
    await view.images.first().hover({ force: true }) // 画像の上に操作ボタンの層が重なっていて、hover の判定を受け止めるため
    await view.removeImageButtons.first().click()

    await expect(view.images).toHaveCount(0)
    expect(dialogs).toEqual([])
    expect((await getCardByApi(ownerPage, project.id, card.id)).images).toEqual([])
    await ownerPage.reload()
    await expect(view.addImageButton).toBeVisible()
    await expect(view.images).toHaveCount(0)
  })

  test('「画像を追加」を押すと画像を選ぶ画面を開き、画像を選ぶとカードの末尾に追加する', spec(SPEC,
    '画像 > 「画像を追加」ボタンを表示する',
    '画像 > 「画像を追加」ボタンを表示する > WHEN 「画像を追加」を押すと',
    '画像 > 「画像を追加」ボタンを表示する > WHEN 「画像を追加」を押すと > WHEN 画像を選ぶと',
  ), async ({ ownerPage, ownerApi, project }) => {
    const card = await ownerApi.addCard(project.id)
    const first = await addImageByApi(ownerPage, project.id, card.id, 'red.png')
    const view = new CardViewPage(ownerPage)
    await view.open(project.id, card.id)
    await expect(view.addImageButton).toBeVisible()

    const chooserPromise = ownerPage.waitForEvent('filechooser')
    await view.addImageButton.click()
    const chooser = await chooserPromise
    expect(chooser.isMultiple()).toBe(false)
    expect(await chooser.element().getAttribute('accept')).toBe('image/*')
    await chooser.setFiles(cardFile('blue.png'))

    await expect(view.images).toHaveCount(2)
    const images = (await getCardByApi(ownerPage, project.id, card.id)).images
    expect(images).toHaveLength(2)
    expect(images[0].filename).toBe(first.filename)
    await expect(view.images.nth(1)).toHaveAttribute('src', `/uploads/thumbs/${images[1].filename}.webp`)
  })

  test('画像以外のファイルを選ぶと、追加しない', spec(SPEC,
    '画像 > 「画像を追加」ボタンを表示する > WHEN 「画像を追加」を押すと > IF 画像以外のファイルを選んだ',
  ), async ({ ownerPage, ownerApi, project }) => {
    const card = await ownerApi.addCard(project.id)
    const view = new CardViewPage(ownerPage)
    await view.open(project.id, card.id)

    const responsePromise = ownerPage.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes(`/cards/${card.id}/images`))
    await view.addImage('not-image.txt')
    expect((await responsePromise).ok()).toBe(false)

    await expect(view.images).toHaveCount(0)
    expect((await getCardByApi(ownerPage, project.id, card.id)).images).toEqual([])
    await ownerPage.reload()
    await expect(view.addImageButton).toBeVisible()
    await expect(view.images).toHaveCount(0)
  })
})

test.describe('前後のカード', () => {
  test('前後のカードは、テーブルビューで並び替えた順で決める', spec(SPEC,
    '前後のカード > 前後のカードは、テーブルビューで並び替え・検索した順で決める',
    '前後のカード > WHERE 前のカードがある場合',
    '前後のカード > WHERE 前のカードがある場合 > WHEN 「前」を押すと',
    '前後のカード > WHERE 次のカードがある場合',
    '前後のカード > WHERE 次のカードがある場合 > WHEN 「次」を押すと',
  ), async ({ ownerPage, ownerApi, project }) => {
    const c1 = await ownerApi.addCard(project.id)
    const c2 = await ownerApi.addCard(project.id)
    const c3 = await ownerApi.addCard(project.id)
    const view = new CardViewPage(ownerPage)
    // ID の降順: c3, c2, c1
    await view.open(project.id, c2.id, 'q=&sort=id&direction=desc')

    await expect(view.previousLink).toBeVisible()
    await expect(view.nextLink).toBeVisible()
    await view.previousLink.click()
    await expect(ownerPage).toHaveURL(new RegExp(`/cards/${c3.id}\\?`))
    await expect(view.idValue).toHaveText(`ID${c3.id}`)
    // 先頭のカードには「前」が無い
    await expect(view.previousLink).toHaveCount(0)

    await view.nextLink.click()
    await expect(view.idValue).toHaveText(`ID${c2.id}`)
    await view.nextLink.click()
    await expect(ownerPage).toHaveURL(new RegExp(`/cards/${c1.id}\\?.*direction=desc`))
    await expect(view.idValue).toHaveText(`ID${c1.id}`)
    await expect(view.nextLink).toHaveCount(0)
  })

  test('前後のカードは、テーブルビューで検索した結果の順で決める', spec(SPEC,
    '前後のカード > 前後のカードは、テーブルビューで並び替え・検索した順で決める',
  ), async ({ ownerPage, ownerApi, project, tag }) => {
    const c1 = await ownerApi.addCard(project.id, { みだし: `当たる${tag}` })
    await ownerApi.addCard(project.id, { みだし: '当たらない' })
    const c3 = await ownerApi.addCard(project.id, { みだし: `当たる${tag}` })
    const view = new CardViewPage(ownerPage)
    await view.open(project.id, c1.id, `q=当たる${tag}`)

    await view.nextLink.click()

    await expect(view.idValue).toHaveText(`ID${c3.id}`)
    await expect(view.previousLink).toHaveAttribute('href', new RegExp(`/cards/${c1.id}\\?`))
  })

  test('次のカードが無い場合は「追加」を表示し、押すと空のカードを末尾に追加して遷移する', spec(SPEC,
    '前後のカード > WHERE 次のカードが無い場合',
    '前後のカード > WHERE 次のカードが無い場合 > WHEN 「追加」を押すと',
  ), async ({ ownerPage, ownerApi, project }) => {
    await ownerApi.addCard(project.id)
    const last = await ownerApi.addCard(project.id, { みだし: '最後のカード' })
    const view = new CardViewPage(ownerPage)
    await view.open(project.id, last.id)
    await expect(view.nextLink).toHaveCount(0)
    await expect(view.addCardButton).toBeVisible()

    await view.addCardButton.click()

    await expect(view.toast('追加しました')).toBeVisible()
    const cards = await listCardsByApi(ownerPage, project.id)
    expect(cards).toHaveLength(3)
    const added = cards[2]
    expect(added.order).toBe(3)
    await expect(ownerPage).toHaveURL(new RegExp(`/cards/${added.id}\\?`))
    await expect(view.idValue).toHaveText(`ID${added.id}`)
    await expect(view.field('みだし')).toHaveValue('')
    await expect(view.previousLink).toHaveAttribute('href', new RegExp(`/cards/${last.id}\\?`))
  })

  test('【既知の問題】検索中に「追加」を押すと、追加したカードではなく検索結果の最後のカードを表示する（あるべき: 追加したカードを表示する）', withIssue(
    spec(SPEC, '前後のカード > WHERE 次のカードが無い場合 > WHEN 「追加」を押すと'),
    knownIssue('docs/ISSUES.md', '検索中にカードを追加すると別のカードを表示する'),
  ), async ({ ownerPage, ownerApi, project, tag }) => {
    const hit = await ownerApi.addCard(project.id, { みだし: `当たる${tag}` })
    const view = new CardViewPage(ownerPage)
    await view.open(project.id, hit.id, `q=当たる${tag}`)

    await view.addCardButton.click()

    await expect(view.toast('追加しました')).toBeVisible()
    const cards = await listCardsByApi(ownerPage, project.id)
    expect(cards).toHaveLength(2)
    const added = cards[1]
    await expect(ownerPage).toHaveURL(new RegExp(`/cards/${added.id}\\?`))
    // 遷移した先は追加したカードの URL だが、検索結果の最後のカード（hit）を表示している
    await expect(view.idValue).toHaveText(`ID${hit.id}`)
    await expect(view.field('みだし')).toHaveValue(`当たる${tag}`)
  })
})

test.describe('カードのメニュー', () => {
  test('「…」を押すとメニューを開く', spec(SPEC,
    'カードのメニュー > 「…」を押すと、次のメニューを開く',
  ), async ({ ownerPage, ownerApi, project }) => {
    const card = await ownerApi.addCard(project.id)
    const view = new CardViewPage(ownerPage)
    await view.open(project.id, card.id)

    await view.menuButton.click()

    for (const name of ['直下に複製', '末尾に複製', '別プロジェクトに複製', '複製元カードを表示', '複製先カードを表示', '削除']) {
      await expect(view.menuItem(name)).toBeVisible()
    }
  })

  test('「直下に複製」で、すぐ下に複製して「複製しました」と表示し、複製したカードに遷移する', spec(SPEC,
    'カードのメニュー > 直下に複製',
  ), async ({ ownerPage, ownerApi, project }) => {
    const original = await ownerApi.addCard(project.id, { みだし: '複製するカード' })
    const after = await ownerApi.addCard(project.id, { みだし: '後のカード' })
    const view = new CardViewPage(ownerPage)
    await view.open(project.id, original.id)

    await view.openMenu()
    await view.menuItem('直下に複製').click()

    await expect(view.toast('複製しました')).toBeVisible()
    const cards = await listCardsByApi(ownerPage, project.id)
    expect(cards.map((c) => c.id)).toEqual([original.id, cards[1].id, after.id])
    const duplicated = cards[1]
    await expect(ownerPage).toHaveURL(new RegExp(`/cards/${duplicated.id}\\?`))
    await expect(view.idValue).toHaveText(`ID${duplicated.id}`)
    await expect(view.orderValue).toHaveText('並び順2')
    await expect(view.field('みだし')).toHaveValue('複製するカード')
  })

  test('「末尾に複製」で、末尾に複製して「複製しました」と表示し、複製したカードに遷移する', spec(SPEC,
    'カードのメニュー > 末尾に複製',
  ), async ({ ownerPage, ownerApi, project }) => {
    const original = await ownerApi.addCard(project.id, { みだし: '複製するカード' })
    await ownerApi.addCard(project.id, { みだし: '後のカード' })
    const view = new CardViewPage(ownerPage)
    await view.open(project.id, original.id)

    await view.openMenu()
    await view.menuItem('末尾に複製').click()

    await expect(view.toast('複製しました')).toBeVisible()
    const cards = await listCardsByApi(ownerPage, project.id)
    expect(cards).toHaveLength(3)
    const duplicated = cards[2]
    await expect(ownerPage).toHaveURL(new RegExp(`/cards/${duplicated.id}\\?`))
    await expect(view.idValue).toHaveText(`ID${duplicated.id}`)
    await expect(view.orderValue).toHaveText('並び順3')
    await expect(view.field('みだし')).toHaveValue('複製するカード')
  })

  test('「別プロジェクトに複製」で複製先のプロジェクトを選ぶダイアログを開き、複製すると複製先のカードに遷移する', spec(SPEC,
    'カードのメニュー > 別プロジェクトに複製',
  ), async ({ ownerPage, ownerApi, project, tag }) => {
    const other = await ownerApi.createProject(`複製先${tag}`)
    const card = await ownerApi.addCard(project.id, { みだし: '複製するカード' })
    const view = new CardViewPage(ownerPage)
    await view.open(project.id, card.id)

    await view.openMenu()
    await view.menuItem('別プロジェクトに複製').click()
    const dialog = view.dialog('別プロジェクトに複製')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(project.name, { exact: true })).toHaveCount(0)
    await dialog.getByText(other.name, { exact: true }).click()

    await expect(view.toast('複製しました')).toBeVisible()
    const [duplicated] = await listCardsByApi(ownerPage, other.id)
    await expect(ownerPage).toHaveURL(new RegExp(`/projects/${other.id}/cards/${duplicated.id}$`))
    await expect(view.text(other.name)).toBeVisible()
    await expect(view.field('みだし')).toHaveValue('複製するカード')
  })

  test('【既知の問題】「別プロジェクトに複製」で「新しいプロジェクト」に複製すると、遷移した先でプロジェクトを開けない（あるべき: 複製したカードを表示する）', withIssue(
    spec(SPEC, 'カードのメニュー > 別プロジェクトに複製'),
    knownIssue('docs/ISSUES.md', '新しいプロジェクトに複製するとプロジェクトを開けない'),
  ), async ({ ownerPage, ownerApi, project }) => {
    const card = await ownerApi.addCard(project.id, { みだし: '複製するカード' })
    const view = new CardViewPage(ownerPage)
    await view.open(project.id, card.id)
    const projectsBefore = await ownerApi.call<{ id: number }[]>('get', '/api/projects')

    await view.openMenu()
    await view.menuItem('別プロジェクトに複製').click()
    const dialog = view.dialog('別プロジェクトに複製')
    const responsePromise = ownerPage.waitForResponse((r) => r.url().includes('/cards/duplicate'))
    await dialog.getByText('新しいプロジェクト', { exact: true }).click()
    const [duplicated] = await (await responsePromise).json() as { id: number, projectId: number }[]

    await expect(ownerPage).toHaveURL(new RegExp(`/projects/${duplicated.projectId}/cards/${duplicated.id}$`))
    // 作ったプロジェクトにはオーナーがいないので、何も表示しない（エラー画面にもならない）。プロジェクト一覧にも出ない
    await expect(view.idValue).toHaveCount(0)
    await expect(view.field('みだし')).toHaveCount(0)
    await expect(view.addImageButton).toHaveCount(0)
    await expect(view.menuButton).toHaveCount(0)
    expect(await ownerApi.call<{ id: number }[]>('get', '/api/projects')).toEqual(projectsBefore)
  })

  test('「複製元カードを表示」は複製元が無いと選べず、複製したカードでは複製元のカードに遷移する', spec(SPEC,
    'カードのメニュー > 複製元カードを表示',
  ), async ({ ownerPage, ownerApi, project }) => {
    const original = await ownerApi.addCard(project.id, { みだし: '複製元' })
    const [duplicated] = await ownerApi.call<{ id: number }[]>('post', `/api/projects/${project.id}/cards/duplicate`, { cardId: [original.id], toProjectId: project.id })
    const view = new CardViewPage(ownerPage)
    await view.open(project.id, original.id)
    await view.openMenu()
    await expect(view.menuItem('複製元カードを表示')).toBeDisabled()
    await ownerPage.keyboard.press('Escape')

    await view.open(project.id, duplicated.id)
    await view.openMenu()
    await view.menuItem('複製元カードを表示').click()

    await expect(ownerPage).toHaveURL(new RegExp(`/projects/${project.id}/cards/${original.id}$`))
    await expect(view.idValue).toHaveText(`ID${original.id}`)
  })

  test('「複製先カードを表示」は複製先が無いと選べず、複製元のカードでは複製先を選ぶダイアログを開く', spec(SPEC,
    'カードのメニュー > 複製先カードを表示',
  ), async ({ ownerPage, ownerApi, project, tag }) => {
    const other = await ownerApi.createProject(`複製先${tag}`)
    const original = await ownerApi.addCard(project.id, { みだし: '複製元' })
    const [duplicated] = await ownerApi.call<{ id: number }[]>('post', `/api/projects/${project.id}/cards/duplicate`, { cardId: [original.id], toProjectId: other.id })
    const view = new CardViewPage(ownerPage)
    await view.open(other.id, duplicated.id)
    await view.openMenu()
    await expect(view.menuItem('複製先カードを表示')).toBeDisabled()
    await ownerPage.keyboard.press('Escape')

    await view.open(project.id, original.id)
    await view.openMenu()
    await view.menuItem('複製先カードを表示').click()

    const dialog = view.dialog('複製先カード')
    await expect(dialog).toBeVisible()
    await dialog.getByText(`${other.name} - ID: ${duplicated.id}`).click()
    await expect(ownerPage).toHaveURL(new RegExp(`/projects/${other.id}/cards/${duplicated.id}$`))
  })

  test('「削除」で確認するとカードを削除して「削除しました」と表示する。次のカードが無ければ（カードが無くなれば）テーブルビューに遷移する', spec(SPEC,
    'カードのメニュー > 削除',
  ), async ({ ownerPage, ownerApi, project }) => {
    const card = await ownerApi.addCard(project.id)
    const view = new CardViewPage(ownerPage)
    await view.open(project.id, card.id)
    const messages: string[] = []
    ownerPage.on('dialog', async (dialog) => {
      messages.push(dialog.message())
      await dialog.accept()
    })

    await view.openMenu()
    await view.menuItem('削除').click()

    await expect(view.toast('削除しました')).toBeVisible()
    expect(messages).toEqual(['削除してよろしいですか？'])
    await expect(ownerPage).toHaveURL(new RegExp(`/projects/${project.id}\\?`))
    expect(await listCardsByApi(ownerPage, project.id)).toEqual([])
  })

  test('【既知の問題】「削除」で確認して削除すると、次のカードがあってもテーブルビューに遷移する（あるべき: 次のカードに遷移する）', withIssue(
    spec(SPEC, 'カードのメニュー > 削除'),
    knownIssue('docs/ISSUES.md', 'カード入力ビューでカードを削除すると次のカードに遷移しない'),
  ), async ({ ownerPage, ownerApi, project }) => {
    const first = await ownerApi.addCard(project.id)
    const target = await ownerApi.addCard(project.id)
    const next = await ownerApi.addCard(project.id)
    const view = new CardViewPage(ownerPage)
    await view.open(project.id, target.id, 'q=&sort=order&direction=asc')
    ownerPage.on('dialog', (dialog) => dialog.accept())

    await view.openMenu()
    await view.menuItem('削除').click()

    await expect(view.toast('削除しました')).toBeVisible()
    // 削除して一覧を取り直すと、画面のカードが一覧の最後のカードに変わり、その「次」を探すため見つからない
    await expect(ownerPage).toHaveURL(`/projects/${project.id}?q=&sort=order&direction=asc`)
    expect((await listCardsByApi(ownerPage, project.id)).map((c) => c.id)).toEqual([first.id, next.id])
  })

  test('【既知の問題】「削除」の確認で取り消しても、カードは削除しないが次のカードに遷移する（あるべき: 遷移しない）', withIssue(
    spec(SPEC, 'カードのメニュー > 削除'),
    knownIssue('docs/ISSUES.md', 'カード入力ビューでカードを削除すると次のカードに遷移しない'),
  ), async ({ ownerPage, ownerApi, project }) => {
    const target = await ownerApi.addCard(project.id)
    const next = await ownerApi.addCard(project.id)
    const view = new CardViewPage(ownerPage)
    await view.open(project.id, target.id)
    ownerPage.on('dialog', (dialog) => dialog.dismiss())

    await view.openMenu()
    await view.menuItem('削除').click()

    await expect(ownerPage).toHaveURL(new RegExp(`/cards/${next.id}\\?`))
    await expect(view.idValue).toHaveText(`ID${next.id}`)
    await expect(view.toast('削除しました')).toHaveCount(0)
    expect((await listCardsByApi(ownerPage, project.id)).map((c) => c.id)).toEqual([target.id, next.id])
  })

  test('【既知の問題】次のカードが無いときに「削除」の確認で取り消しても、テーブルビューに遷移する（あるべき: 遷移しない）', withIssue(
    spec(SPEC, 'カードのメニュー > 削除'),
    knownIssue('docs/ISSUES.md', 'カード入力ビューでカードを削除すると次のカードに遷移しない'),
  ), async ({ ownerPage, ownerApi, project }) => {
    const target = await ownerApi.addCard(project.id)
    const view = new CardViewPage(ownerPage)
    await view.open(project.id, target.id)
    ownerPage.on('dialog', (dialog) => dialog.dismiss())

    await view.openMenu()
    await view.menuItem('削除').click()

    await expect(ownerPage).toHaveURL(new RegExp(`/projects/${project.id}\\?`))
    expect((await listCardsByApi(ownerPage, project.id)).map((c) => c.id)).toEqual([target.id])
  })
})
