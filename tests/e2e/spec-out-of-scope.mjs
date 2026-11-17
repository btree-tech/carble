// 画面の E2E テストで確かめない仕様書の項目と、その理由（scripts/check-spec-coverage.mjs が読む）
//
// item は「仕様書 > 段 > 段」の形（support/spec.ts の spec() と同じ書き方）。
// 画面から見える部分は対象外にしない。
// 項目は仕様書のまとまりごとに out-of-scope/*.mjs に書き、ここで集める

import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const CATEGORIES = {
  external: '外部のサービス（Google）が要る',
  device: '端末・ブラウザに依存する（カメラ・印刷のダイアログ）',
  infra: 'サーバーの環境・運用で、画面に現れない',
}

const dir = join(dirname(fileURLToPath(import.meta.url)), 'out-of-scope')

/** @type {{ item: string, category: keyof typeof CATEGORIES, reason: string }[]} */
export const OUT_OF_SCOPE = []
for (const name of readdirSync(dir).filter((n) => n.endsWith('.mjs')).sort()) {
  const module = await import(pathToFileURL(join(dir, name)).href)
  OUT_OF_SCOPE.push(...module.default)
}
