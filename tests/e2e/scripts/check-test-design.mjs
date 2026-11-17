// docs/test-design のルール ID と、テストのタグの対応を確かめる（決まりの正は docs/test-design/README.md）。
//
//   node scripts/check-test-design.mjs                     # 不整合があれば exit 1（Playwright のテストの一覧を取るので runner の中で動かす）
//   node scripts/check-test-design.mjs --list <file.json>  # Playwright の一覧を渡す（`playwright test --list --reporter=json` の出力）
//   node scripts/check-test-design.mjs --spec-only         # 仕様書が記述ルール（出典注記・EARS の節）に合うかだけを確かめる

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkKnownIssues, checkSpecWriting, checkTestDesign, isExcludedSpecFile, listPlaywrightTests, parseReadme } from './lib/test-design.mjs'

const E2E_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ROOT_DIR = resolve(E2E_DIR, '../..')
const SPEC_DIR = join(ROOT_DIR, 'docs/product-spec')
const DESIGN_DIR = join(ROOT_DIR, 'docs/test-design')
// VRT の正解の画像（playwright.config.ts の snapshotPathTemplate）
const SNAPSHOT_DIR = join(E2E_DIR, 'snapshots')

function listMarkdown(dir, base = dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return listMarkdown(full, base)
    return entry.name.endsWith('.md') ? [relative(base, full)] : []
  }).sort()
}

function readPlaywrightList() {
  const index = process.argv.indexOf('--list')
  if (index !== -1) return JSON.parse(readFileSync(process.argv[index + 1], 'utf8'))
  const output = execFileSync('pnpm', ['exec', 'playwright', 'test', '--list', '--reporter=json'], {
    cwd: E2E_DIR,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  return JSON.parse(output)
}

function main() {
  const specFiles = listMarkdown(SPEC_DIR).filter((file) => !isExcludedSpecFile(file))
  const specSources = Object.fromEntries(specFiles.map((file) => [file, readFileSync(join(SPEC_DIR, file), 'utf8')]))

  if (process.argv.includes('--spec-only')) {
    const errors = checkSpecWriting(specSources)
    console.log(`仕様書: ${specFiles.length}`)
    if (errors.length) {
      console.error(`\n${errors.length}件の問題:`)
      for (const error of errors) console.error(`  - ${error}`)
      return 1
    }
    console.log('\n仕様書は記述ルールに合っています。')
    return 0
  }

  const designFiles = listMarkdown(DESIGN_DIR).filter((file) => file !== 'README.md')
  const report = readPlaywrightList()
  if ((report.errors || []).length) {
    console.error('E2E テストの一覧を取得できませんでした:')
    for (const error of report.errors) console.error(`  ${error.message || JSON.stringify(error)}`)
    return 1
  }

  const browserTests = listPlaywrightTests(report)
  const { errors, definitions, outOfScopeIds, pendingIds } = checkTestDesign({
    readme: parseReadme(readFileSync(join(DESIGN_DIR, 'README.md'), 'utf8')),
    specFiles,
    specSources,
    designSources: Object.fromEntries(designFiles.map((file) => [file, readFileSync(join(DESIGN_DIR, file), 'utf8')])),
    browserTests,
    snapshots: existsSync(SNAPSHOT_DIR) ? readdirSync(SNAPSHOT_DIR).filter((file) => !file.startsWith('.')).sort() : [],
  })
  errors.push(...checkKnownIssues(browserTests, {
    issuesSource: readFileSync(join(ROOT_DIR, 'docs/ISSUES.md'), 'utf8'),
    specFiles,
  }))

  const stories = definitions.filter((definition) => definition.isStoryTable)
  const visuals = definitions.filter((definition) => definition.isVisualTable)
  console.log(`テスト設計のファイル: ${designFiles.length} / ルール: ${definitions.length}（うちユーザーストーリー ${stories.length}・VRT ${visuals.length}）/ 対象外: ${outOfScopeIds.size} / テスト未作成: ${pendingIds.length}`)

  if (errors.length) {
    console.error(`\n${errors.length}件の問題:`)
    for (const error of errors) console.error(`  - ${error}`)
    return 1
  }
  console.log('\nテスト設計とテストの対応に問題はありません。')
  return 0
}

process.exit(main())
