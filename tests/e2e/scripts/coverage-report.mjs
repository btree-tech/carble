// E2E のカバレッジのレポートを作る（E2E_COVERAGE=1 pnpm test:e2e の最後に、scripts/run.sh が runner の中で動かす）
//
// 読むもの（共有のボリューム /coverage。docker-compose.e2e.yml）
// - client/: ブラウザ側（support/coverage.ts が書く）
// - server/: サーバー側（app の NODE_V8_COVERAGE。app を止めたときに書き出される）
// - app/: app がビルドしたファイル（.output）。スクリプトの本文とソースマップをここから読む
//
// 書くもの: tests/e2e/coverage/（index.html と、ほかのツールで読める lcov.info、要約の coverage-summary.md）
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import MCR from 'monocart-coverage-reports'

const ROOT = '/coverage'
/** app の中の、ビルドしたファイル（Dockerfile で .output を /carble/app に置く）と、写した先 */
const APP_SERVER_URL = 'file:///carble/app/'
const APP = join(ROOT, 'app')
/** ビルドした場所（Dockerfile の build ステージ）。ソースマップの sources は、ここからの相対パスになっている */
const BUILD = '/carble/packages/app/.output'

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))
const jsonFiles = (dir) => existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => join(dir, f)) : []

/** 製品のコード（packages/app。依存・Nuxt が作るファイルを除く） */
const isAppSource = (sourcePath) => sourcePath.includes('packages/app/')
  && !sourcePath.includes('node_modules') && !sourcePath.includes('.nuxt') && !sourcePath.includes('virtual')

/** ビルドした場所のリポジトリ（/carble）と、runner の中のリポジトリ（/work） */
const BUILD_REPO = '/carble/'
const REPO = '/work/'

/**
 * .output の中のファイル（relativePath）の隣のソースマップ。無いか、対応づけが空なら undefined。
 * - sources を、ビルドした場所から解決した絶対パス（/carble/packages/app/... など）に直す
 * - 元のソースの本文が入っていないもの（サーバーの API など）は、リポジトリのファイルから補う
 *   （ビルドしたときと同じ版のソースで流すこと。E2E_SKIP_BUILD で古いイメージを使うと行がずれる）
 */
const sourceMapOf = (relativePath) => {
  const file = join(APP, relativePath)
  if (!existsSync(`${file}.map`)) return undefined
  const map = readJson(`${file}.map`)
  if (!map.mappings) return undefined
  const base = resolve(dirname(join(BUILD, relativePath)), map.sourceRoot ?? '')
  const sources = map.sources.map((source) => resolve(base, source))
  // 製品のコードを含まないもの（アイコンのデータ・サーバーの入り口など）は除く。MCR は、元のファイルが全部除かれると、ビルドしたファイルのまま数えてしまう
  if (!sources.some(isAppSource)) return undefined
  const sourcesContent = sources.map((source, i) => {
    if (typeof map.sourcesContent?.[i] === 'string') return map.sourcesContent[i]
    const inRepo = source.startsWith(BUILD_REPO) ? join(REPO, source.slice(BUILD_REPO.length)) : undefined
    return inRepo && existsSync(inRepo) ? readFileSync(inRepo, 'utf8') : null
  })
  return { ...map, sourceRoot: undefined, sources, sourcesContent }
}

// 前のレポートを消す（runner が書いたファイルなので、runner の中で消す）
rmSync('coverage', { recursive: true, force: true })

const mcr = MCR({
  name: 'Carble E2E カバレッジ',
  outputDir: 'coverage',
  // markdown-summary（coverage-summary.md）は、GitHub Actions の実行のページの Summary に出す
  reports: ['v8', 'lcovonly', 'console-summary', 'markdown-summary'],
  cleanCache: true,
  // ソースマップで元に戻したファイルのうち、製品のコード（packages/app。Nuxt が作るファイルを除く）だけを残す
  sourceFilter: isAppSource,
  sourcePath: (filePath) => filePath.replace(/^.*?packages\/app\//, 'packages/app/'),
})

// ブラウザ側
const sources = new Map(jsonFiles(join(ROOT, 'client', 'sources')).map((file) => {
  const { url, source } = readJson(file)
  return [url, source]
}))
const loadedUrls = new Set(sources.keys())
let clientCount = 0
for (const file of jsonFiles(join(ROOT, 'client', 'entries'))) {
  const entries = readJson(file)
    .map((entry) => ({ ...entry, source: sources.get(entry.url), sourceMap: sourceMapOf(join('public', new URL(entry.url).pathname)) }))
    // ソースマップの無いもの（ビルドの外から来たスクリプト）は、製品のコードに対応づけられないので除く
    .filter(({ source, sourceMap }) => source !== undefined && sourceMap)
  await mcr.add(entries)
  clientCount += 1
}

// サーバー側（app のサーバーのファイルのうち、ソースマップのあるもの。.output/server/node_modules の依存は除く）
let serverCount = 0
for (const file of jsonFiles(join(ROOT, 'server'))) {
  const entries = readJson(file).result
    .filter(({ url }) => url.startsWith(`${APP_SERVER_URL}server/`) && !url.includes('/node_modules/'))
    .map((entry) => {
      const relativePath = fileURLToPath(entry.url).slice(fileURLToPath(APP_SERVER_URL).length)
      return { ...entry, source: readFileSync(join(APP, relativePath), 'utf8'), sourceMap: sourceMapOf(relativePath) }
    })
    .filter(({ sourceMap }) => sourceMap)
  if (!entries.length) continue
  for (const { url } of entries) loadedUrls.add(url)
  await mcr.add(entries)
  serverCount += 1
}

if (!clientCount && !serverCount) {
  console.error('カバレッジがありません（/coverage の client/entries・server）')
  process.exit(1)
}

// 一度も読み込まれなかったスクリプト（開かなかった画面・呼ばなかった API など）も、実行されなかったものとして足し、0% でレポートに出す。
// 元のソース（.vue・.ts）からではなく、ビルドしたファイルから数えるので、読み込まれたファイルと同じ数え方になる
// （ビルドに入らなかったファイル、どこからも使われていないものはレポートに出ない）
const listFiles = (dir, pattern) => existsSync(join(APP, dir))
  ? readdirSync(join(APP, dir), { recursive: true }).map((f) => join(dir, f)).filter((f) => pattern.test(f) && !f.includes('node_modules'))
  : []
const unloaded = [
  ...listFiles('public/_nuxt', /\.js$/).map((relativePath) => ({
    relativePath,
    url: new URL(relativePath.slice('public'.length), process.env.BASE_URL).toString(),
  })),
  ...listFiles('server/chunks', /\.mjs$/).map((relativePath) => ({ relativePath, url: `${APP_SERVER_URL}${relativePath}` })),
]
  .filter(({ url }) => !loadedUrls.has(url))
  .map(({ relativePath, url }) => ({
    url,
    empty: true,
    source: readFileSync(join(APP, relativePath), 'utf8'),
    sourceMap: sourceMapOf(relativePath),
  }))
  .filter(({ sourceMap }) => sourceMap)
await mcr.add(unloaded)

console.log(`ブラウザ側 ${clientCount} 画面・サーバー側 ${serverCount} プロセスの結果と、読み込まれなかった ${unloaded.length} ファイルからレポートを作る`)
await mcr.generate()
