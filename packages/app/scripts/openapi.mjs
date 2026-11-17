// API の仕様（OpenAPI）を、各ハンドラーの defineRouteMeta から作り、docs/product-spec/api/ に書き出す
//
//   pnpm openapi            # ビルドして書き出す
//   pnpm openapi --check    # ビルドして、書き出したものとずれていないかを確かめる（ずれていれば exit 1。CI）
//
// Nitro の実験的な機能（nuxt.config.ts の nitro.experimental.openAPI）が、ファイルの置き場所から API の一覧を、
// defineRouteMeta の openAPI から各 API の説明を作る。各 API の仕様は、defineRouteMeta の独自の要素に表の行（配列）で書く。
// - x-input: 入力 [場所, 名前, 型, 必須, 内容]
// - x-process: 処理 [条件, 処理]
// - x-output: 出力 [状態, 条件, 本文]
// - x-errors: エラー [状態, 条件]（ログイン・メンバー・ロールによるものは features/roles.md に書く）
// - x-implementation-gap: 実装との乖離（任意）[内容]
// defineRouteMeta には文字列などの値しか書けず（テンプレート文字列を読まない）、空の文字列は Nitro が取り除く。
//
// 書き出すもの
// - openapi.json: OpenAPI。各 API の description に、4 つの表を Markdown で入れる（独自の要素は除く）
// - <タグ>.md: タグごとの仕様。ほかの仕様書と同じ章立てで、テスト設計（docs/test-design/api/）と結び付ける
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ROOT_DIR = resolve(APP_DIR, '../..')
const OUT_DIR = join(ROOT_DIR, 'docs/product-spec/api')
const GENERATED = join(APP_DIR, '.output/public/_openapi.json')

/** タグ（defineRouteMeta の openAPI.tags の 1 つ目）ごとの仕様書。ここに無いタグはエラーにする */
const TAGS = {
  projects: 'プロジェクト',
  cards: 'カード',
  fields: '項目',
  images: '画像',
  imports: 'インポート',
  members: 'メンバー',
  system: 'その他',
}
const METHODS = ['get', 'post', 'put', 'delete']

/** 4 つの表。見出しの列は、テスト設計の検査が入力の表を見分けるのに使う（tests/e2e/scripts/lib/test-design.mjs） */
const TABLES = [
  { key: 'x-input', label: '入力', header: ['場所', '名前', '型', '必須', '内容'] },
  { key: 'x-process', label: '処理', header: ['条件', '処理'] },
  { key: 'x-output', label: '出力', header: ['状態', '条件', '本文'] },
  { key: 'x-errors', label: 'エラー', header: ['状態', '条件'] },
]

/** 製品の API だけを残す（Nuxt が持つ経路を除く） */
const isProductPath = (path) => (path.startsWith('/api/') || path.startsWith('/uploads/')) && !path.startsWith('/api/_nuxt_icon')

function build() {
  execFileSync('pnpm', ['exec', 'nuxi', 'build'], {
    cwd: APP_DIR,
    // 書き出すときに認証の設定を読むので、秘密の文字列が無いとエラーを表示する（書き出しには使わない）
    env: { BETTER_AUTH_SECRET: 'openapi-build-secret-0123456789abcdef', ...process.env, CARBLE_OPENAPI: '1' },
    stdio: ['ignore', 'ignore', 'inherit'],
  })
}

const cell = (text) => String(text).replaceAll('|', '\\|')

function renderTable({ label, header }, rows) {
  if (!rows.length) return [label, '', '無し', '']
  return [
    label,
    '',
    `| ${header.join(' | ')} |`,
    `|${header.map(() => '---').join('|')}|`,
    ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
    '',
  ]
}

function readOperations(generated) {
  const errors = []
  const operations = []
  const paths = {}
  for (const path of Object.keys(generated.paths).filter(isProductPath).sort()) {
    for (const method of METHODS) {
      const operation = generated.paths[path][method]
      if (!operation) continue
      const name = `${method.toUpperCase()} ${path}`
      const tag = operation.tags?.[0]
      if (!TAGS[tag]) errors.push(`${name}: defineRouteMeta の openAPI.tags が無いか、知らないタグ（${tag}）`)
      if (!operation.summary) errors.push(`${name}: defineRouteMeta の openAPI.summary が無い`)

      const tables = TABLES.map((table) => {
        const rows = operation[table.key]
        if (!Array.isArray(rows)) {
          errors.push(`${name}: defineRouteMeta の openAPI['${table.key}']（${table.label}）が無い。無ければ空の配列にする`)
          return { table, rows: [] }
        }
        for (const row of rows) {
          if (!Array.isArray(row) || row.length !== table.header.length) {
            errors.push(`${name}: ${table.label}の行の列の数が ${table.header.length} でない（空の文字列は使えない）: ${JSON.stringify(row)}`)
          }
        }
        return { table, rows }
      })
      const gaps = (operation['x-implementation-gap'] ?? []).map((row) => [row].flat()[0])
      const description = tables.flatMap(({ table, rows }) => renderTable(table, rows)).join('\n').trimEnd()

      const rest = Object.fromEntries(Object.entries(operation).filter(([key]) => !key.startsWith('x-')))
      paths[path] = { ...paths[path], [method]: { ...rest, description } }
      operations.push({ name, tag, summary: operation.summary, description, gaps })
    }
  }
  return { errors, operations, openapi: { ...generated, paths } }
}

function renderMarkdown(tag, operations) {
  const title = TAGS[tag]
  const gaps = operations.flatMap(({ name, summary, gaps }) => gaps.map((gap) => `- ${summary}（${name}）: ${gap}`))
  return [
    `# API: ${title}`,
    '',
    '<!-- pnpm openapi で生成する。直接直さず、各ハンドラー（packages/app/server/）の defineRouteMeta を直して生成し直す -->',
    '',
    `画面が裏で使う API（[openapi.json](openapi.json)）のうち、${title}のもの。API ごとに、入力・処理・出力・エラーを表で書く。ログインしていない・メンバーでない・ロールが足りないなどで受け付けない場合は、[ロールと権限](../features/roles.md#サーバーでの権限の確認)に書く。`,
    '',
    '## ユーザーストーリー（Why）',
    '',
    '画面が裏で使う API で、利用者の目的は各画面・機能の仕様書に書く。',
    '',
    '## 外部仕様（What）',
    '',
    ...operations.flatMap(({ name, summary, description }) => [`### ${name}（${summary}）`, '', description, '']),
    '## 補足情報',
    '',
    '### 実装との乖離',
    '',
    ...(gaps.length ? gaps : ['- 無し']),
    '',
    '### 変更履歴',
    '',
    '- [CESCHI-251](https://kinako.atlassian.net/browse/CESCHI-251) 今の実装から書き起こした',
    '',
  ].join('\n')
}

function main() {
  const check = process.argv.includes('--check')
  build()
  if (!existsSync(GENERATED)) {
    console.error(`OpenAPI が作られていません: ${GENERATED}`)
    return 1
  }
  const { errors, operations, openapi } = readOperations(JSON.parse(readFileSync(GENERATED, 'utf8')))
  if (errors.length) {
    console.error(`${errors.length}件の問題:`)
    for (const error of errors) console.error(`  - ${error}`)
    return 1
  }

  const outputs = { 'openapi.json': `${JSON.stringify(openapi, null, 2)}\n` }
  for (const tag of Object.keys(TAGS)) {
    const tagged = operations.filter((operation) => operation.tag === tag)
    if (tagged.length) outputs[`${tag}.md`] = renderMarkdown(tag, tagged)
  }

  if (check) {
    const stale = Object.entries(outputs)
      .filter(([file, content]) => !existsSync(join(OUT_DIR, file)) || readFileSync(join(OUT_DIR, file), 'utf8') !== content)
      .map(([file]) => file)
    if (stale.length) {
      console.error(`docs/product-spec/api/ がコードとずれています（pnpm openapi で書き出し直す）: ${stale.join(', ')}`)
      return 1
    }
    console.log(`docs/product-spec/api/ はコードと合っています（API ${operations.length} 件）`)
    return 0
  }

  mkdirSync(OUT_DIR, { recursive: true })
  for (const [file, content] of Object.entries(outputs)) writeFileSync(join(OUT_DIR, file), content)
  console.log(`docs/product-spec/api/ に書き出しました（API ${operations.length} 件: ${Object.keys(outputs).join(', ')}）`)
  return 0
}

process.exit(main())
