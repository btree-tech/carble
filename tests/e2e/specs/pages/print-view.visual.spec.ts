import { expect, test } from '../../fixtures/visual'
import { PrintViewPage } from '../../pages/PrintViewPage'
import { expectScreen } from '../../support/visual'

// QR コードは、プロジェクトの ID（実行ごとに変わる）を含む URL なので塗る。プレビューの枠で切り取られるので、mask でなく CSS で塗る
const QR_CODES = ['img[src^="data:"]']

for (const [layout, id] of [['パターン1', 'VRT1'], ['パターン2', 'VRT2'], ['パターン3', 'VRT3']] as const) {
  test(`すべてのカードの印刷（レイアウトは${layout}）`, { tag: [`@TC-PG-PRINT-${id}`] }, async ({ visualPage, sample }) => {
    const print = new PrintViewPage(visualPage)
    await print.open(sample.project.id)
    if (layout !== 'パターン1') await print.layoutSelect.selectOption({ label: layout })
    await expect(print.layoutSelect.locator('option:checked')).toHaveText(layout)
    await expect(print.cards).toHaveCount(3)

    await expectScreen(visualPage, { blackout: QR_CODES })
  })
}

test('1 枚のカードの印刷', { tag: ['@TC-PG-PRINT-VRT5'] }, async ({ visualPage, sample }) => {
  const print = new PrintViewPage(visualPage)
  await print.open(sample.project.id, sample.cards[0].id)
  await expect(print.cards).toHaveCount(1)
  await expect(print.cardViewLink).toBeVisible()

  await expectScreen(visualPage, { blackout: QR_CODES })
})
