import { expect, test } from '../../fixtures/visual'
import { PrintViewPage } from '../../pages/PrintViewPage'
import { expectScreen } from '../../support/visual'

test('すべてのカードの印刷（レイアウトはパターン1）', { tag: ['@TC-PG-PRINT-VRT4'] }, async ({ visualPage, sample }) => {
  const print = new PrintViewPage(visualPage)
  await print.open(sample.project.id)
  await expect(print.cards).toHaveCount(3)

  // QR コードは、プロジェクトの ID（実行ごとに変わる）を含む URL なので塗る。プレビューの枠で切り取られるので、mask でなく CSS で塗る
  await expectScreen(visualPage, { blackout: ['img[src^="data:"]'] })
})
