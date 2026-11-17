import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 全テストの前に 1 回だけ動く
 *
 * 保存先のフォルダを、本番の storage と同じ構成に作っておく。
 * 製品は uploads/imports と uploads/public/thumbs を作らないため、まっさらな保存先ではインポートと縮小画像が失敗する
 * （docs/ISSUES.md「まっさらな保存先ではインポートと縮小画像が失敗する」）
 */
export default function globalSetup() {
  const uploads = process.env.UPLOADS_PATH
  if (!uploads) throw new Error('環境変数 UPLOADS_PATH がありません（docker-compose.e2e.yml の runner で設定する）')
  for (const dir of ['imports', 'public/images', 'public/thumbs']) {
    mkdirSync(join(uploads, dir), { recursive: true })
  }
}
