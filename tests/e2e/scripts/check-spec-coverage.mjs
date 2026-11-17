// 仕様書の項目とテストの対応を確認する（pnpm run coverage:spec）
//
// docs/product-spec の pages / features の「外部仕様（What）」の項目が、次のどれかに当たることを確かめる
// - 画面のテストの annotation（support/spec.ts の spec()）で確かめている
// - 対象外リスト（spec-out-of-scope.mjs）に、区分と理由付きで入っている
// - 子の項目があり、子がすべて上のどちらかに当たる（対象外にした項目の子は、対象外とする）
//
// 当たらない項目があるか、annotation・対象外リストが仕様書の項目を指していなければ、exit 1 で終わる
// あわせて、既知の問題の注記が docs/ISSUES.md の見出しを指していることも確かめる
// --verbose: 項目ごとの対応を出す

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import { flatten, loadSpecs, resolve } from './lib/spec-items.mjs'
import { CATEGORIES, OUT_OF_SCOPE } from '../spec-out-of-scope.mjs'

const E2E_DIR = resolvePath(dirname(fileURLToPath(import.meta.url)), '..')
const PRODUCT_SPEC_DIR = resolvePath(E2E_DIR, '../../docs/product-spec')
const verbose = process.argv.includes('--verbose')

/** playwright test --list の JSON から、テストと annotation を集める */
function listTests() {
  const output = execFileSync('pnpm', ['exec', 'playwright', 'test', '--list', '--reporter=json'], {
    cwd: E2E_DIR,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: '' },
  })
  const report = JSON.parse(output)
  const tests = []
  const walk = (suite, titles) => {
    for (const child of suite.suites ?? []) walk(child, [...titles, child.title])
    for (const specEntry of suite.specs ?? []) {
      for (const test of specEntry.tests ?? []) {
        tests.push({
          title: [...titles, specEntry.title].filter(Boolean).join(' › '),
          file: specEntry.file,
          project: test.projectName,
          annotations: test.annotations ?? [],
        })
      }
    }
  }
  for (const suite of report.suites ?? []) walk(suite, [])
  return tests
}

const specs = loadSpecs(PRODUCT_SPEC_DIR)
const errors = []

// 既知の問題の注記（knownIssue('docs/ISSUES.md', '<見出し>')）が、ISSUES.md に実在する見出しを指していること
// 章立てを変えても読めるよう、深さを問わず見出しを集める
const issueHeadings = new Set(readFileSync(resolvePath(E2E_DIR, '../../docs/ISSUES.md'), 'utf8').split('\n')
  .map((line) => line.match(/^#{2,6} (.+)$/)?.[1].trim()).filter(Boolean))

// テストの annotation
const coveredBy = new Map()
const tests = listTests()
for (const test of tests) {
  for (const annotation of test.annotations.filter((a) => a.type === 'known-issue' && a.description.startsWith('docs/ISSUES.md: '))) {
    const heading = annotation.description.slice('docs/ISSUES.md: '.length)
    if (!issueHeadings.has(heading)) errors.push(`${test.file}「${test.title}」: docs/ISSUES.md に見出し「${heading}」がありません`)
  }
}
for (const test of tests) {
  for (const annotation of test.annotations.filter((a) => a.type === 'spec')) {
    const { node, error } = resolve(specs, annotation.description)
    if (error) {
      errors.push(`${test.file}「${test.title}」: ${error}`)
      continue
    }
    const list = coveredBy.get(node) ?? []
    if (!list.includes(test.title)) list.push(test.title)
    coveredBy.set(node, list)
  }
}

// 対象外リスト
const excluded = new Map()
for (const entry of OUT_OF_SCOPE) {
  if (!CATEGORIES[entry.category]) errors.push(`対象外リスト: 区分が不正です（${entry.category}）: ${entry.item}`)
  if (!entry.reason?.trim()) errors.push(`対象外リスト: 理由がありません: ${entry.item}`)
  const { node, error } = resolve(specs, entry.item)
  if (error) {
    errors.push(`対象外リスト: ${error}`)
    continue
  }
  // 対象外にした項目の子も対象外とする（親と同じ理由で確かめられないため）
  const mark = (target) => {
    excluded.set(target, entry)
    for (const child of target.children) mark(child)
  }
  mark(node)
}

// 項目ごとの判定
function status(node) {
  if (coveredBy.has(node)) return 'covered'
  if (excluded.has(node)) return 'excluded'
  if (node.children.length && node.children.every((child) => status(child) !== 'missing')) return 'implied'
  return 'missing'
}

const summary = []
const missing = []
for (const [file, roots] of specs) {
  const items = flatten(file, roots).filter(({ node }) => node.kind !== 'section')
  const counts = { covered: 0, excluded: 0, implied: 0, missing: 0 }
  for (const item of items) {
    const result = status(item.node)
    counts[result]++
    if (result === 'missing') missing.push(item)
    if (verbose) {
      const detail = result === 'covered'
        ? coveredBy.get(item.node).join(' / ')
        : result === 'excluded' ? `${CATEGORIES[excluded.get(item.node).category]}: ${excluded.get(item.node).reason}` : ''
      console.log(`[${result}] ${item.key}${detail ? `\n    ${detail}` : ''}`)
    }
  }
  summary.push({ file, total: items.length, ...counts })
}

console.log('\n仕様書ごとの対応')
console.log('| 仕様書 | 項目 | テスト | 対象外 | 子で充足 | 未対応 |')
console.log('|---|---|---|---|---|---|')
for (const row of summary) {
  console.log(`| ${row.file} | ${row.total} | ${row.covered} | ${row.excluded} | ${row.implied} | ${row.missing} |`)
}
const total = summary.reduce((acc, row) => {
  for (const key of ['total', 'covered', 'excluded', 'implied', 'missing']) acc[key] += row[key]
  return acc
}, { total: 0, covered: 0, excluded: 0, implied: 0, missing: 0 })
console.log(`| 合計 | ${total.total} | ${total.covered} | ${total.excluded} | ${total.implied} | ${total.missing} |`)

if (missing.length) {
  console.log(`\n未対応の項目（${missing.length} 件）。テストに spec() で付けるか、spec-out-of-scope.mjs に区分と理由を書く`)
  for (const item of missing) console.log(`- ${item.key}  (${join('docs/product-spec', item.file)}:${item.node.line})`)
}
if (errors.length) {
  console.log(`\nエラー（${errors.length} 件）`)
  for (const error of errors) console.log(`- ${error}`)
}
process.exit(missing.length || errors.length ? 1 : 0)
