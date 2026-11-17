// docs/test-design のルール ID と、テストのタグの対応を確かめる判定の部分。
// 書き方の決まりの正は docs/test-design/README.md。ファイルの読み書きと Playwright の実行は check-test-design.mjs が行う。
//参考にした別のプロジェクトの検査を Carble 向けに移した（層はブラウザ E2E だけ。Red の annotation は求めない）

import path from 'node:path'

const ID_PATTERN = /TC-[A-Z]{2}-[A-Z][A-Z0-9]{1,8}-[A-Z]{1,4}[0-9]+/g
const ID_EXACT = /^TC-([A-Z]{2})-([A-Z][A-Z0-9]{1,8})-([A-Z]{1,4})([0-9]+)$/
const PREFIX_PATTERN = /^[A-Z][A-Z0-9]{1,8}$/
export const AREA_BY_DIR = {
  pages: 'PG',
  features: 'FT',
}
export const LAYERS = ['ブラウザ E2E']
const STORY_TYPE = 'US'
const FORBIDDEN_TYPES = ['S', 'T']
// 仕様書のユーザーストーリーの章を見分ける語（仕様書の章は「ユーザーストーリー（Why）」）
const SPEC_STORY_HEADING = 'ユーザーストーリー'
const STORY_HEADING = 'テスト設計（ユーザーストーリー）'
const ABOLISHED_HEADING = '廃止した ID'
// 仕様書の振る舞いの章 → テスト設計の章（docs/product-spec/writing-rules.md の章立て）
const SECTION_HEADING_BY_SPEC = {
  '外部仕様（What）': 'テスト設計（外部仕様）',
}
const DESIGN_SECTION_HEADINGS = [...new Set(Object.values(SECTION_HEADING_BY_SPEC))]
// 仕様書に無い、テスト設計だけの章。見出しの突き合わせから外す
const COMBINATION_HEADING = '組み合わせ'
const LACK_HEADING = '仕様の不足'
const RESERVED_HEADINGS = [STORY_HEADING, COMBINATION_HEADING, LACK_HEADING, ABOLISHED_HEADING]
const STORY_TAG = '@story'
// テストを後から足すファイルの印。最初の章より前（仕様のリンクの下）に置く（docs/test-design/README.md の「テストを後から足すとき」）
const PENDING_TESTS_LINE = 'テスト: 一部未作成'
// 機械が読む語。普通の文と見分けられるよう、テスト設計ではコードスパンで囲んで書く。
// docs/test-design/README.md の「機械が読む語」の表と揃える（checkReadme が照らす）
const OUT_LABEL = '対象外'
const GONE_LABEL = '廃止'
const NOTE_LABEL = '備考'
const QUOTE_LABEL = '仕様'
export const MARK_LABELS = [OUT_LABEL, GONE_LABEL, NOTE_LABEL, QUOTE_LABEL]
// 対象外の種類。自動テストの代わりに何で確かめるか・あとに何が残るかを分ける
const LACK_KIND = '不足'
const REFERENCE_KIND = '参照'
const DEFERRED_KIND = '見送り'
// 「要判断」は、どの種類にするか・対象外のままにするかを人が決めるまでの置き場
export const OUT_OF_SCOPE_KINDS = [LACK_KIND, REFERENCE_KIND, '手段なし', '乖離', '振る舞いなし', DEFERRED_KIND, '要判断']
const README_WORDS_HEADING = '機械が読む語'

/** テスト設計を置かない仕様ファイル。理由は README の「対象のファイル」。 */
export function isExcludedSpecFile(relativePath) {
  if (relativePath.split(path.sep)[0] === 'info') return true
  return ['README.md', 'writing-rules.md'].includes(path.basename(relativePath))
}

// docs/product-spec/writing-rules.md の出典注記の形式に一致させる。課題番号の注記は、括弧の全角・半角と区切りの読点・カンマを問わないが、括弧の左右はそろえる。
// それ以外の書式ゆれは findSourceNoteProblems で見つける
const ISSUE_NOTE_BODY = 'CESCHI-\\d+(?:\\s*[、,，]\\s*CESCHI-\\d+)*(?:\\s*[、,，]\\s*理由は推測)?'
const SOURCE_NOTE_PATTERN = new RegExp(`(?:（${ISSUE_NOTE_BODY}）|\\(${ISSUE_NOTE_BODY}\\)|（推測、確信度: [高中低]）)$`)
const LEFTOVER_NOTE_PATTERN = /[（(][^（）()]*(?:CESCHI\s*[-－‐–—]?\s*[\d０-９]|推測|確信度)[^（）()]*[）)][。．.]?\s*$/i

export function normalizeStory(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[「」『』()（）]/g, '')
    .trim()
}

/**
 * ユーザーストーリー節の箇条書きを読む。出典を書き換えても表の引用を直さずに済むよう、text からは末尾の出典注記を取り除く。
 * 子を持つ箇条書き（文脈の見出しや上位のストーリー）は 1 件と数えず子の接頭辞にするため、hasChildren で区別する。
 */
function parseStoryBullets(markdown) {
  const bullets = []
  let inStorySection = false

  for (const line of markdown.split(/\r?\n/)) {
    if (/^#{2,3}\s/.test(line)) {
      inStorySection = line.includes(SPEC_STORY_HEADING)
      continue
    }
    if (!inStorySection) continue

    const match = line.match(/^([ \t]*)-[ \t]+(.*\S)\s*$/)
    if (match) bullets.push({ indent: match[1].replace(/\t/g, '  ').length, raw: match[2], text: match[2].replace(SOURCE_NOTE_PATTERN, '') })
  }

  return bullets.map((bullet, index) => {
    const next = bullets[index + 1]
    return { ...bullet, hasChildren: Boolean(next && next.indent > bullet.indent) }
  })
}

/**
 * 出典注記が writing-rules.md の書き方に合っていない箇条書きを返す。
 * 子を持つ箇条書きは文脈の見出しのことも上位のストーリーのこともあり機械的に見分けられないため、注記の有無は問わない。
 */
export function findSourceNoteProblems(markdown) {
  const problems = []
  for (const bullet of parseStoryBullets(markdown)) {
    // 形式外の注記や二重の注記は本文に残り、表に引用されると照合でも見つからなくなる
    if (LEFTOVER_NOTE_PATTERN.test(bullet.text)) {
      problems.push(`出典注記の書式が違うか二重になっている: ${bullet.raw}`)
      continue
    }
    if (!SOURCE_NOTE_PATTERN.test(bullet.raw)) {
      if (!bullet.hasChildren) problems.push(`出典注記が無いか書式が違う: ${bullet.raw}`)
      continue
    }
    if (/\s$/.test(bullet.text)) problems.push(`出典注記の前に空白がある: ${bullet.raw}`)
  }
  return problems
}

/**
 * 仕様書のユーザーストーリーを抜き出す。
 * 子を持つ箇条書きは文脈の見出しでありストーリー本体ではないため、子側をストーリーとし、本文には親を接頭辞として残す。
 */
export function extractStoriesFromMarkdown(markdown) {
  const bullets = parseStoryBullets(markdown)

  return bullets
    .map((bullet, index) => {
      if (bullet.hasChildren) return null

      const prefixes = []
      for (let i = index - 1; i >= 0; i -= 1) {
        const candidate = bullets[i]
        if (candidate.indent < (prefixes.length ? prefixes[0].indent : bullet.indent)) prefixes.unshift(candidate)
      }
      return [...prefixes.map((prefix) => prefix.text), bullet.text].join(' ')
    })
    .filter(Boolean)
}

// セルの中の `|` は `\|` と書く（Markdown の表の書き方）。区切りにせず、`|` に戻す
function splitRow(line) {
  return line.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '').split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'))
}

function isSeparatorRow(cells) {
  return cells.every((cell) => /^:?-+:?$/.test(cell))
}

function stripCode(cell) {
  return cell.replace(/^`(.*)`$/, '$1')
}

/** Markdown を、見出しの文脈つきの表と箇条書きに分ける（コードブロックの中は読まない）。 */
function parseMarkdown(markdown) {
  const tables = []
  const bullets = []
  const texts = []
  let heading = ''
  let h2 = ''
  let inCode = false
  let current = null

  const lines = markdown.split(/\r?\n/)
  lines.forEach((line, index) => {
    if (/^\s*```/.test(line)) {
      inCode = !inCode
      current = null
      return
    }
    if (inCode) return

    const headingMatch = line.match(/^(#{1,6})\s+(.*\S)\s*$/)
    if (headingMatch) {
      heading = headingMatch[2]
      if (headingMatch[1].length <= 2) h2 = heading
      current = null
      return
    }

    if (/^\s*\|/.test(line)) {
      const cells = splitRow(line)
      if (!current) {
        current = { heading, h2, header: cells, rows: [], line: index + 1 }
        tables.push(current)
      } else if (!(current.rows.length === 0 && isSeparatorRow(cells))) {
        current.rows.push(cells)
      }
      return
    }
    current = null

    const bullet = line.match(/^-[ \t]+(.*\S)\s*$/)
    if (bullet) bullets.push({ heading, h2, text: bullet[1], line: index + 1 })
    else if (line.trim()) texts.push({ heading, h2, text: line, line: index + 1 })
  })

  return { tables, bullets, texts }
}

/** README の「ファイルと接頭辞の一覧」「廃止した接頭辞」「領域」「機械が読む語」を読む。 */
export function parseReadme(markdown) {
  const { tables } = parseMarkdown(markdown)
  const rows = []
  const abolished = []
  const areas = []
  const words = []

  for (const table of tables) {
    const header = table.header.map(stripCode)
    if (table.heading === README_WORDS_HEADING && header[0] === '語') {
      for (const cells of table.rows) words.push(stripCode(cells[0] || ''))
    }
    if (table.h2 === 'ファイルと接頭辞の一覧' && header[0] === '仕様') {
      for (const cells of table.rows) {
        const link = cells[0].match(/^\[([^\]]+)\]\(([^)]+)\)$/)
        rows.push({
          file: link ? link[1] : cells[0],
          href: link ? link[2] : '',
          area: stripCode(cells[1] || ''),
          prefix: stripCode(cells[2] || ''),
          note: cells[3] || '',
        })
      }
    }
    if (table.h2 === '廃止した接頭辞' && header[0] === '領域') {
      for (const cells of table.rows) {
        abolished.push({ area: stripCode(cells[0] || ''), prefix: stripCode(cells[1] || ''), file: cells[2] || '' })
      }
    }
    if (table.heading === '領域' && header[0] === 'ディレクトリ') {
      for (const cells of table.rows) {
        areas.push({ dir: stripCode(cells[0]).replace(/\/$/, ''), area: stripCode(cells[1] || '') })
      }
    }
  }
  return { rows, abolished, areas, words }
}

const MARK_LABEL_ALT = MARK_LABELS.join('|')
const MARK_ID = 'TC-[^\\s:：`]+'
const CODE_SPAN = '`[^`]*`'
// 印の行: 「- `対象外` `不足` <ID>: 理由」「- `備考` <ID>: 内容」。種類は対象外にだけ付ける
const MARK_PATTERN = new RegExp('^`(' + MARK_LABEL_ALT + ')`(?:[ \\t]+`([^`]*)`)?[ \\t]+(' + MARK_ID + ')[ \\t]*[:：][ \\t]*(.*)$')
// 印の行のつもりで書いたとみなす形。どれかに当たるのに MARK_PATTERN に合わない行は、読み飛ばさずに誤りにする
const MARK_LOOKALIKES = [
  new RegExp('^`(?:' + MARK_LABEL_ALT + ')`'),
  new RegExp('^(?:' + MARK_LABEL_ALT + ')[^\\s`]*[ \\t]+(?:' + CODE_SPAN + '[ \\t]+)?TC-'),
  new RegExp('^(?:' + CODE_SPAN + '|[^\\s`]{1,10})[ \\t]+(?:' + CODE_SPAN + '[ \\t]+)?' + MARK_ID + '[ \\t]*[:：]'),
  new RegExp('^' + MARK_ID + '[ \\t]*[:：]'),
]

/**
 * 箇条書きの本文を印の行として読む。
 * 印の行でなければ null、印の行のつもりで形が違えば { problem } を返す。
 */
function parseMark(text) {
  const match = text.match(MARK_PATTERN)
  if (!match) {
    if (!MARK_LOOKALIKES.some((pattern) => pattern.test(text))) return null
    return { problem: `「- \`印\` <ID>: 内容」の形で書く（印は ${MARK_LABELS.join('・')}。対象外は「- \`${OUT_LABEL}\` \`種類\` <ID>: 理由」）` }
  }
  const [, label, kind, id, body] = match
  if (label === OUT_LABEL && !OUT_OF_SCOPE_KINDS.includes(kind)) {
    return { problem: `対象外には種類を付ける（${OUT_OF_SCOPE_KINDS.join('・')}）` }
  }
  if (label !== OUT_LABEL && kind !== undefined) return { problem: `種類は「${OUT_LABEL}」にだけ付ける` }
  return { label, kind, id, body: body.trim() }
}

/**
 * テスト設計のファイルから、ルールの定義・対象外・廃止・参照を読む。
 * 定義は、表の 1 列目のセルと、見出し行（1 列目を除く。決定表・直交表のルールの列）のセルのうち、セル全体が ID のもの。
 */
export function parseDesign(file, markdown) {
  const { tables, bullets, texts } = parseMarkdown(markdown)
  const definitions = []
  const references = []
  const outOfScope = []
  const abolished = []
  const notes = []
  const malformed = []

  const pushReferences = (text, where) => {
    for (const id of text.match(ID_PATTERN) || []) references.push({ id, where })
  }

  for (const table of tables) {
    const isStoryTable = table.h2 === STORY_HEADING
    const header = table.header.map(stripCode)
    const layerColumn = header.indexOf('層')
    const storyColumn = header.indexOf('ストーリー')
    const layerRow = table.rows.find((cells) => stripCode(cells[0]) === '層')

    header.forEach((cell, column) => {
      if (column === 0 || !ID_EXACT.test(cell) && !/^TC-/.test(cell)) {
        if (column !== 0) pushReferences(cell, `${file}:${table.line}`)
        return
      }
      definitions.push({
        id: cell,
        file,
        line: table.line,
        heading: table.heading,
        h2: table.h2,
        isStoryTable,
        layer: layerRow ? stripCode(layerRow[column] || '') : '',
      })
    })

    for (const cells of table.rows) {
      const first = stripCode(cells[0] || '')
      if (/^TC-/.test(first)) {
        definitions.push({
          id: first,
          file,
          line: table.line,
          heading: table.heading,
          h2: table.h2,
          isStoryTable,
          layer: layerColumn === -1 ? '' : stripCode(cells[layerColumn] || ''),
          story: isStoryTable && storyColumn !== -1 ? cells[storyColumn] || '' : undefined,
        })
      } else {
        pushReferences(cells[0] || '', `${file}:${table.line}`)
      }
      cells.slice(1).forEach((cell) => pushReferences(cell, `${file}:${table.line}`))
    }
  }

  for (const bullet of bullets) {
    const where = `${file}:${bullet.line}`
    const mark = parseMark(bullet.text)
    if (mark && mark.problem) {
      malformed.push({ text: bullet.text, problem: mark.problem, where })
      pushReferences(bullet.text, where)
    } else if (mark && mark.label === OUT_LABEL) {
      outOfScope.push({ id: mark.id, kind: mark.kind, body: mark.body, where })
      pushReferences(mark.body, where)
    } else if (mark && mark.label === GONE_LABEL) {
      abolished.push({ id: mark.id, body: mark.body, where, inAbolishedSection: bullet.h2 === ABOLISHED_HEADING })
    } else if (mark && mark.label === NOTE_LABEL) {
      notes.push({ id: mark.id, body: mark.body, where })
      pushReferences(mark.body, where)
    } else {
      pushReferences(bullet.text, where)
    }
  }
  for (const text of texts) {
    const where = `${file}:${text.line}`
    // 字下げした箇条書きは印の行として読まない。印の行のつもりの形なら、読み飛ばさずに誤りにする
    const nested = text.text.match(/^[ \t]+-[ \t]+(.*\S)\s*$/)
    if (nested && parseMark(nested[1])) malformed.push({ text: nested[1], problem: '印の行は字下げしない', where })
    pushReferences(text.text, where)
  }
  const hasLackItems = bullets.some((bullet) => bullet.h2 === LACK_HEADING)
  const lines = markdown.split(/\r?\n/)
  const firstSection = lines.findIndex((line) => /^##\s/.test(line))
  const pendingTests = lines.slice(0, firstSection === -1 ? lines.length : firstSection).some((line) => line.trim() === PENDING_TESTS_LINE)

  return { file, definitions, references, outOfScope, abolished, notes, malformed, hasLackItems, pendingTests }
}

/** `playwright test --list --reporter=json` の結果を、テストごとのタグにする。 */
export function listPlaywrightTests(report) {
  const tests = []
  const walk = (suite, titles) => {
    for (const spec of suite.specs || []) {
      tests.push({
        file: `tests/e2e/${spec.file}`,
        title: [...titles, spec.title].join(' › '),
        tags: [...new Set((spec.tags || []).map((tag) => (tag.startsWith('@') ? tag : `@${tag}`)))],
        knownIssues: [...new Set((spec.tests || []).flatMap((test) => test.annotations || []).filter((annotation) => annotation.type === 'known-issue').map((annotation) => annotation.description || ''))],
        // test.fixme / test.skip で実行しないテストは何も確かめないので、タグがあっても確かめたことに数えない
        skipped: (spec.tests || []).length > 0 && (spec.tests || []).every((test) => test.expectedStatus === 'skipped'),
      })
    }
    for (const child of suite.suites || []) walk(child, [...titles, child.title])
  }
  for (const fileSuite of report.suites || []) walk(fileSuite, [])
  return tests
}

function checkReadme(readme, specFiles) {
  const errors = []
  const areaByDir = Object.fromEntries(readme.areas.map((row) => [row.dir, row.area]))
  for (const [dir, area] of Object.entries(AREA_BY_DIR)) {
    if (areaByDir[dir] !== area) errors.push(`README の領域の表と検査の領域が食い違う: ${dir} → ${areaByDir[dir] || '(無し)'}（検査は ${area}）`)
  }

  const expectedWords = [...MARK_LABELS, ...OUT_OF_SCOPE_KINDS]
  const readmeWords = readme.words || []
  if (expectedWords.length !== readmeWords.length || expectedWords.some((word) => !readmeWords.includes(word))) {
    errors.push(`README の「${README_WORDS_HEADING}」の表と検査の語が食い違う: README は ${readmeWords.join('・') || '(無し)'}（検査は ${expectedWords.join('・')}）`)
  }

  const listed = new Set(readme.rows.map((row) => row.file))
  for (const file of specFiles) {
    if (!listed.has(file)) errors.push(`README の一覧に無い仕様ファイル: ${file}`)
  }
  const specSet = new Set(specFiles)
  const seen = new Map()
  const abolishedKeys = new Set(readme.abolished.map((row) => `${row.area}-${row.prefix}`))

  for (const row of readme.rows) {
    if (!specSet.has(row.file)) errors.push(`README の一覧の仕様ファイルが無い（または対象外）: ${row.file}`)
    if (row.href !== `/docs/product-spec/${row.file}`) errors.push(`README の一覧のリンク先が表示と食い違う: ${row.file} → ${row.href}`)
    if (!PREFIX_PATTERN.test(row.prefix)) errors.push(`接頭辞の形が違う: ${row.file} の ${row.prefix}`)
    const dirArea = AREA_BY_DIR[row.file.split('/')[0]]
    if (row.area !== dirArea && !row.note.includes('移した')) {
      errors.push(`領域がディレクトリと食い違う（移したなら備考に「移した」と書く）: ${row.file} の ${row.area}（ディレクトリは ${dirArea || '未定義'}）`)
    }
    const key = `${row.area}-${row.prefix}`
    if (seen.has(key)) errors.push(`同じ領域で接頭辞が重なる: ${key}（${seen.get(key)} と ${row.file}）`)
    seen.set(key, row.file)
    if (abolishedKeys.has(key)) errors.push(`廃止した接頭辞を使い回している: ${key}（${row.file}）`)
  }
  return errors
}

/**
 * テスト設計の全ファイルとテストを突き合わせる。
 * @param {object} input
 * @param {ReturnType<typeof parseReadme>} input.readme
 * @param {string[]} input.specFiles テスト設計を置く仕様ファイル（docs/product-spec からの相対パス）
 * @param {Record<string, string>} input.specSources 仕様ファイル → 中身
 * @param {Record<string, string>} input.designSources テスト設計のファイル（docs/test-design からの相対パス） → 中身
 * @param {ReturnType<typeof listPlaywrightTests>} input.browserTests
 */
export function checkTestDesign(input) {
  const { readme, specFiles, specSources, designSources, browserTests } = input
  const errors = [...checkReadme(readme, specFiles)]
  const rowByFile = new Map(readme.rows.map((row) => [row.file, row]))

  for (const file of Object.keys(designSources)) {
    if (!rowByFile.has(file)) errors.push(`README の一覧に無いテスト設計のファイル: ${file}`)
  }

  const designs = []
  for (const row of readme.rows) {
    if (!(row.file in designSources)) {
      errors.push(`テスト設計のファイルが無い: docs/test-design/${row.file}`)
      continue
    }
    designs.push({ row, design: parseDesign(row.file, designSources[row.file]) })
  }

  const definitionById = new Map()
  const abolishedIds = new Map()

  for (const { row, design } of designs) {
    for (const definition of design.definitions) {
      const match = definition.id.match(ID_EXACT)
      const where = `${definition.file}:${definition.line}`
      if (!match) {
        errors.push(`ID の形が違う: ${definition.id}（${where}）`)
        continue
      }
      const [, area, prefix, type, number] = match
      if (area !== row.area || prefix !== row.prefix) {
        errors.push(`ID の領域・接頭辞がファイルの一覧の行と違う: ${definition.id}（${where}。一覧は ${row.area}-${row.prefix}）`)
      }
      if (/^0/.test(number)) errors.push(`ID の番号の先頭に 0 がある: ${definition.id}（${where}）`)
      if (FORBIDDEN_TYPES.includes(type)) errors.push(`種別 ${type} は使わない（状態と遷移の番号と紛らわしい）: ${definition.id}（${where}）`)
      if (type === STORY_TYPE && !definition.isStoryTable) {
        errors.push(`種別 US はユーザーストーリーの表だけで使う: ${definition.id}（${where}）`)
      }
      if (type !== STORY_TYPE && definition.isStoryTable) {
        errors.push(`ユーザーストーリーの表では種別 US だけを使う: ${definition.id}（${where}）`)
      }
      if (definitionById.has(definition.id)) {
        errors.push(`ID が重なる: ${definition.id}（${definitionById.get(definition.id).file} と ${definition.file}）`)
        continue
      }
      if (!LAYERS.includes(definition.layer)) {
        errors.push(`層の値が決まった名前でない: ${definition.id} の「${definition.layer}」（${where}。${LAYERS.join('・')}）`)
      }
      definitionById.set(definition.id, definition)
    }
    for (const gone of design.abolished) {
      if (!gone.inAbolishedSection) errors.push(`廃止の行は「## ${ABOLISHED_HEADING}」の節に置く: ${gone.id}（${gone.where}）`)
      if (!gone.body) errors.push(`廃止の理由が空: ${gone.id}（${gone.where}）`)
      if (abolishedIds.has(gone.id)) errors.push(`廃止の行が重なる: ${gone.id}（${gone.where}）`)
      abolishedIds.set(gone.id, gone)
    }
  }

  for (const id of abolishedIds.keys()) {
    if (definitionById.has(id)) errors.push(`廃止した ID を使い回している: ${id}（${definitionById.get(id).file}）`)
  }

  const outOfScopeIds = new Set(designs.flatMap(({ design }) => design.outOfScope.map((out) => out.id)))
  const specSet = new Set(specFiles)
  for (const { design } of designs) {
    for (const bad of design.malformed) {
      errors.push(`印の行の形が違う: ${bad.text.slice(0, 40)}（${bad.where}。${bad.problem}）`)
    }
    for (const reference of design.references) {
      if (abolishedIds.has(reference.id)) errors.push(`廃止した ID を参照している: ${reference.id}（${reference.where}）`)
      else if (!definitionById.has(reference.id)) errors.push(`定義されていない ID を参照している: ${reference.id}（${reference.where}）`)
    }
    for (const out of design.outOfScope) {
      if (!definitionById.has(out.id)) errors.push(`対象外の ID が表に無い: ${out.id}（${out.where}）`)
      if (!out.body) errors.push(`対象外の理由が空: ${out.id}（${out.where}）`)
      else errors.push(...checkOutOfScopeKind(out, design, { definitionById, outOfScopeIds, specSet, designSources }))
    }
    for (const note of design.notes) {
      if (!definitionById.has(note.id)) errors.push(`備考の ID が表に無い: ${note.id}（${note.where}）`)
    }
  }

  errors.push(...checkStories(designs, specSources))
  errors.push(...checkHeadings(designs, specSources, designSources))
  errors.push(...checkSentences(designs, specSources, designSources))
  const pendingFiles = new Set(designs.filter(({ design }) => design.pendingTests).map(({ design }) => design.file))
  const tests = checkTests({ definitionById, abolishedIds, outOfScopeIds, browserTests, pendingFiles })
  errors.push(...tests.errors)

  return { errors, definitions: [...definitionById.values()], outOfScopeIds, pendingIds: tests.pendingIds }
}

/** 仕様書だけを確かめる（出典注記と、EARS の節に分けられるか）。テスト設計を作る前に記述ルールを確かめるのに使う */
export function checkSpecWriting(specSources) {
  const errors = []
  for (const [file, markdown] of Object.entries(specSources)) {
    for (const problem of findSourceNoteProblems(markdown)) errors.push(`${problem}（${file}）`)
    const reported = new Set()
    for (const sentence of listSpecSentences(markdown)) {
      for (const text of sentence.unsplittable) {
        if (reported.has(text)) continue
        reported.add(text)
        errors.push(`EARS の節に分けられない仕様の文: ${text}（${file}）`)
      }
    }
  }
  return errors
}

const DOC_LINK_PATTERN = /\]\(\/docs\/(product-spec|test-design)\/([^)#\s]+\.md)(?:#[^)]*)?\)/g

/** 対象外の種類ごとに、理由が指す先があるかを確かめる。 */
function checkOutOfScopeKind(out, design, { definitionById, outOfScopeIds, specSet, designSources }) {
  if (out.kind === LACK_KIND && !design.hasLackItems) {
    return [`対象外（${LACK_KIND}）のファイルの「## ${LACK_HEADING}」の節に項目が無い: ${out.id}（${out.where}）`]
  }
  if (out.kind === DEFERRED_KIND && !/\d{4}-\d{2}-\d{2}/.test(out.body)) {
    return [`見送りの理由に決めた日（YYYY-MM-DD）が無い: ${out.id}（${out.where}）`]
  }
  if (out.kind === REFERENCE_KIND) {
    const ids = (out.body.match(ID_PATTERN) || []).filter((id) => id !== out.id && definitionById.has(id))
    const hasLink = [...out.body.matchAll(DOC_LINK_PATTERN)].some(([, root, file]) => (root === 'product-spec' ? specSet.has(file) : file in designSources))
    if (ids.some((id) => !outOfScopeIds.has(id)) || hasLink) return []
    if (ids.length) return [`参照の先がすべて対象外: ${out.id}（${out.where}）`]
    return [`参照の先が無い（確かめるルールの ID か、テスト設計を置く仕様・テスト設計へのリンクを理由に書く）: ${out.id}（${out.where}）`]
  }
  return []
}

/**
 * 見出しを、親の見出しをたどった道筋つきで並べる（コードブロックの中は読まない）。
 * 同じ名前の見出しが別の章にあっても見分けられるよう、道筋で比べる。
 * @param {(h2: string) => string | undefined} sectionName 2 段目の見出しを、テスト設計の章の名前にする。読まない章は undefined
 */
function listSectionHeadings(markdown, sectionName) {
  const headings = []
  // 見出しの範囲の終わりは、読まない章の見出しも含めた次の見出しにする（予約の章の表を前の見出しに数えない）
  const allLines = []
  const stack = []
  let inSection = false
  let inCode = false
  markdown.split(/\r?\n/).forEach((line, index) => {
    if (/^\s*```/.test(line)) inCode = !inCode
    if (inCode) return
    const match = line.match(/^(#{2,6})\s+(.*\S)\s*$/)
    if (!match) return
    allLines.push(index + 1)
    const level = match[1].length
    const name = level === 2 ? sectionName(match[2]) : match[2]
    if (level === 2) inSection = name !== undefined
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop()
    stack.push({ level, text: name === undefined ? match[2] : name })
    // 突き合わせのキーには段も入れる（同じ名前でも段が違えば別の見出し）。表示には名前の道筋を使う
    const key = stack.map((heading) => `${heading.level}:${heading.text}`).join(' > ')
    if (inSection) headings.push({ level, path: stack.map((heading) => heading.text).join(' > '), key, line: index + 1 })
  })
  return headings.map((heading, index) => {
    const next = headings[index + 1]
    const end = allLines.find((line) => line > heading.line) ?? Infinity
    return { ...heading, isLeaf: !next || next.level <= heading.level, end }
  })
}

/**
 * 仕様書の振る舞いの章とテスト設計の見出しを突き合わせる。
 * ユーザーストーリーの表しかないファイル（表に着手していないファイル）は、突き合わせない。
 */
function checkHeadings(designs, specSources, designSources) {
  const errors = []
  for (const { row, design } of designs) {
    if (!design.definitions.some((definition) => !definition.isStoryTable)) continue
    const specHeadings = listSectionHeadings(specSources[row.file] || '', (h2) => SECTION_HEADING_BY_SPEC[h2])
    // テスト設計だけの章（ユーザーストーリー・組み合わせ・仕様の不足・廃止した ID）以外の章を読み、仕様に無い章を見つける
    const designHeadings = listSectionHeadings(designSources[row.file], (h2) => (RESERVED_HEADINGS.includes(h2) ? undefined : h2))
    const specKeys = specHeadings.map((heading) => heading.key)
    const designKeys = designHeadings.map((heading) => heading.key)

    const missing = specHeadings.filter((heading) => !designKeys.includes(heading.key))
    const extra = designHeadings.filter((heading) => !specKeys.includes(heading.key))
    missing.forEach((heading) => errors.push(`仕様の見出しがテスト設計に無い: ${heading.path}（${row.file}。段も同じにする）`))
    extra.forEach((heading) => errors.push(`仕様に無い見出しがテスト設計にある: ${heading.path}（${row.file}。仕様の章に当たる章は ${DESIGN_SECTION_HEADINGS.join('・')}、テスト設計だけの章は ${RESERVED_HEADINGS.join('・')}）`))
    if (!missing.length && !extra.length && specKeys.join('\n') !== designKeys.join('\n')) {
      errors.push(`見出しの並びが仕様と違う（${row.file}）`)
    }

    for (const heading of designHeadings) {
      if (!heading.isLeaf || !specKeys.includes(heading.key)) continue
      const hasRule = design.definitions.some((definition) => definition.line > heading.line && definition.line < heading.end)
      if (!hasRule) errors.push(`ルールも対象外も無い見出し: ${heading.path}（${row.file}）`)
    }
  }
  return errors
}

// EARS のキーワードと、節の終わりのつなぎの語（docs/product-spec/writing-rules.md の「EARS記法のルール」）
// 「〜場合（補足）、」のように、場合と読点の間の補足の括弧も節に含める
const EARS_CONNECTORS = { WHEN: /と、$/, WHILE: /(?:中|間)は、$/, IF: /場合(?:（[^（）]*）)?も?、$/, WHERE: /場合(?:（[^（）]*）)?も?、$/ }
const EARS_CLAUSE_PATTERN = /^(WHEN|WHILE|IF|WHERE) (.+?(?:と、|(?:中|間)は、|場合(?:（[^（）]*）)?も?、))/
// 節に分けたあとの残り（結果）と節の本文にキーワードが残るなら、節に分けられない文とみなす。
// 結果の文頭と句点の直後（2 つ目の文）は、つなぎの語が記載ルールに無い形（「〜したら」「〜とき、」）でも拾う。
// 文の途中は区切り（空白・読点・コロン）の後で英字が続かず、後ろにつなぎの語が続くものだけを拾う
const EARS_CONNECTOR_SOURCE = '(?:と、|(?:中|間)は、|場合(?:（[^（）]*）)?も?、)'
const EARS_STRAY_SENTENCE_START_PATTERN = /(?:^|[。．]\s*)(?:WHEN|WHILE|IF|WHERE)/
const EARS_STRAY_INSIDE_PATTERN = new RegExp(`[\\s。．、:：](?:WHEN|WHILE|IF|WHERE)(?![A-Za-z]).*?${EARS_CONNECTOR_SOURCE}`)
const hasStrayKeyword = (text) => EARS_STRAY_SENTENCE_START_PATTERN.test(text) || EARS_STRAY_INSIDE_PATTERN.test(text)
const EARS_ORDER = ['WHERE', 'WHILE', 'WHEN', 'IF']
// テスト設計の一覧表の列 → EARS のキーワード（docs/test-design/README.md の「一覧表の列」）
const EARS_COLUMNS = { '前提（WHERE）': 'WHERE', '区間（WHILE）': 'WHILE', '操作（WHEN）': 'WHEN', '異常（IF）': 'IF' }
const RESULT_COLUMN = '結果'
// 結果の末尾に書く、その先の流れを定める経路への参照（「（→ TC-…・TC-…）」）。仕様の文には無いので照合の前に外す
const PATH_REFERENCE_PATTERN = /（→\s*TC-[^（）]*）$/

/**
 * 照合の前に、表に書かない記法（太字・リンク・コード）と、文末の課題番号（出典で、振る舞いではない）と句点を外す。
 * 課題番号は全角・半角の括弧のどちらでも、複数を読点・カンマのどちらで区切っても、後ろに句点が続いても外す。
 */
export function normalizeSentence(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .trim()
    .replace(/[。．]$/, '')
    .replace(/(?:（CESCHI-\d+(?:\s*[、,，]\s*CESCHI-\d+)*）|\(CESCHI-\d+(?:\s*[、,，]\s*CESCHI-\d+)*\))$/, '')
    .replace(/[。．]$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * EARS の文を、節（キーワードと、キーワード・末尾の読点を除いた本文）と結果に分ける。
 * キーワードで始まるのに節に分けられない文は ok: false にする（つなぎの語がキーワードと合わない・形が違うなど）。
 */
export function splitEars(sentence) {
  const clauses = []
  let rest = sentence
  for (;;) {
    const match = rest.match(EARS_CLAUSE_PATTERN)
    if (!match || !EARS_CONNECTORS[match[1]].test(match[2])) break
    clauses.push({ keyword: match[1], text: match[2].replace(/、$/, '') })
    rest = rest.slice(match[0].length).trim()
  }
  const ok = !hasStrayKeyword(rest) && !clauses.some((clause) => /[。．]\s*(?:WHEN|WHILE|IF|WHERE)/.test(clause.text) || EARS_STRAY_INSIDE_PATTERN.test(clause.text + '、'))
  return { clauses, result: rest, ok }
}

function earsKey(clauses, result) {
  const sorted = EARS_ORDER.flatMap((keyword) => clauses.filter((clause) => clause.keyword === keyword))
  return JSON.stringify([sorted.map((clause) => [clause.keyword, clause.text]), result])
}

/**
 * 仕様書の振る舞いの章の箇条書きを、親の文の節を引き継いだ照合のキーにする。
 * 親の文の結果は引き継がない（子の文は親の条件のもとでの別の振る舞い）。
 * 表の行にしなければならないのは子を持たない文（isLeaf）だけで、子を持つ文は行にしてもしなくてもよい。
 * 見出し（###・####）も返す（テスト設計の表を仕様から起こすスクリプトが使う）。
 */
export function listSpecSentences(markdown) {
  const bullets = []
  let inSection = false
  let inCode = false
  const headings = []
  for (const [lineIndex, line] of markdown.split(/\r?\n/).entries()) {
    if (/^\s*```/.test(line)) inCode = !inCode
    if (inCode) continue
    const h2 = line.match(/^##\s+(.*\S)\s*$/)
    if (h2) {
      inSection = h2[1] in SECTION_HEADING_BY_SPEC
      headings.length = 0
      continue
    }
    const deeper = line.match(/^(#{3,6})\s+(.*\S)\s*$/)
    if (deeper && inSection) {
      const level = deeper[1].length
      while (headings.length && headings[headings.length - 1].level >= level) headings.pop()
      headings.push({ level, text: deeper[2] })
      continue
    }
    const bullet = line.match(/^([ \t]*)-[ \t]+(.*\S)\s*$/)
    if (inSection && bullet) {
      bullets.push({
        line: lineIndex + 1,
        indent: bullet[1].replace(/\t/g, '  ').length,
        raw: bullet[2],
        text: normalizeSentence(bullet[2]),
        headings: headings.map((heading) => ({ ...heading })),
      })
    }
  }
  return bullets.map((bullet, index) => {
    const next = bullets[index + 1]
    const ancestors = []
    let indent = bullet.indent
    for (let i = index - 1; i >= 0; i -= 1) {
      if (bullets[i].indent < indent) {
        ancestors.unshift(bullets[i])
        indent = bullets[i].indent
      }
    }
    const parts = [...ancestors, bullet].map((item) => ({ text: item.text, ...splitEars(item.text) }))
    const own = parts[parts.length - 1]
    return {
      line: bullet.line,
      indent: bullet.indent,
      text: bullet.text,
      raw: bullet.raw,
      headings: bullet.headings,
      ancestors: ancestors.map((item) => item.text),
      isLeaf: !(next && next.indent > bullet.indent),
      clauses: parts.flatMap((part) => part.clauses),
      result: own.result,
      key: earsKey(parts.flatMap((part) => part.clauses), own.result),
      unsplittable: parts.filter((part) => !part.ok).map((part) => part.text),
    }
  })
}

// テスト設計の表のうち、仕様の表を写した表で、仕様の列でない列（docs/test-design/README.md の「仕様の表」）
const DESIGN_ONLY_COLUMNS = ['ID', '層', '代表値']

function tableKey(header, cells) {
  return JSON.stringify([header.map(normalizeSentence), cells.map(normalizeSentence)])
}

/**
 * 仕様書の振る舞いの章の表を、行ごとの照合のキーにする（Carble で足した検査。参考にした別のプロジェクトは表を照合しない）。
 * 見出し行と区切り行は行に数えない。キーは列の名前と、行のセルの組。
 */
export function listSpecTableRows(markdown) {
  const { tables } = parseMarkdown(markdown)
  return tables
    .filter((table) => table.h2 in SECTION_HEADING_BY_SPEC)
    .flatMap((table) => table.rows.map((cells, index) => ({
      // 見出し行と区切り行の後ろから数える
      line: table.line + 2 + index,
      heading: table.heading,
      header: table.header,
      cells,
      text: cells.map(normalizeSentence).join(' | '),
      key: tableKey(table.header, cells),
    })))
}

/** テスト設計の振る舞いの章から、仕様の表を写した表（結果の列も EARS の列も無い表）の行を照合のキーにする。 */
function listDesignTableRows(markdown) {
  const { tables } = parseMarkdown(markdown)
  const rows = []
  for (const table of tables) {
    if (!DESIGN_SECTION_HEADINGS.includes(table.h2)) continue
    const header = table.header.map(stripCode)
    if (header.includes(RESULT_COLUMN) || header.some((name) => name in EARS_COLUMNS)) continue
    const columns = header.flatMap((name, index) => (DESIGN_ONLY_COLUMNS.includes(name) ? [] : [index]))
    for (const cells of table.rows) {
      rows.push({
        id: stripCode(cells[0] || ''),
        line: table.line,
        key: tableKey(columns.map((index) => table.header[index]), columns.map((index) => cells[index] || '')),
      })
    }
  }
  return rows
}

/**
 * テスト設計の振る舞いの章から、一覧表の行（結果の列を持つ表）と、表の下の「- 仕様 <ID>: <文>」を照合のキーにする。
 * 組み合わせの章の行・引用は、仕様に無い行を見つけるためだけに読む（仕様の文を満たす行には数えない。onlyCheck）。
 */
function listDesignRows(markdown) {
  const { tables, bullets } = parseMarkdown(markdown)
  const rows = []
  const readable = (h2) => DESIGN_SECTION_HEADINGS.includes(h2) || h2 === COMBINATION_HEADING
  for (const table of tables) {
    if (!readable(table.h2)) continue
    const header = table.header.map(stripCode)
    const resultColumn = header.indexOf(RESULT_COLUMN)
    if (resultColumn === -1) continue
    for (const cells of table.rows) {
      const clauses = []
      header.forEach((name, column) => {
        const keyword = EARS_COLUMNS[name]
        const value = normalizeSentence(cells[column] || '')
        if (keyword && value) value.split(' → ').forEach((text) => clauses.push({ keyword, text: text.trim() }))
      })
      const result = normalizeSentence(cells[resultColumn] || '').replace(PATH_REFERENCE_PATTERN, '').trim()
      rows.push({ id: stripCode(cells[0] || ''), line: table.line, key: earsKey(clauses, result), onlyCheck: table.h2 === COMBINATION_HEADING })
    }
  }
  for (const bullet of bullets) {
    if (!readable(bullet.h2)) continue
    const quote = parseMark(bullet.text)
    if (!quote || quote.label !== QUOTE_LABEL) continue
    const { clauses, result } = splitEars(normalizeSentence(quote.body))
    rows.push({ id: quote.id, line: bullet.line, key: earsKey(clauses, result), onlyCheck: bullet.h2 === COMBINATION_HEADING })
  }
  return rows
}

/**
 * 仕様書の振る舞いの文と、テスト設計の表の行を、EARS の節と結果の組で突き合わせる。
 * 見出しの突き合わせと同じく、ユーザーストーリーの表しかないファイルは確かめない。
 */
function checkSentences(designs, specSources, designSources) {
  const errors = []
  for (const { row, design } of designs) {
    if (!design.definitions.some((definition) => !definition.isStoryTable)) continue
    const sentences = listSpecSentences(specSources[row.file] || '')
    const designRows = listDesignRows(designSources[row.file])
    const designKeys = new Set(designRows.filter((designRow) => !designRow.onlyCheck).map((designRow) => designRow.key))
    const specKeys = new Set(sentences.map((sentence) => sentence.key))
    const reported = new Set()

    for (const sentence of sentences) {
      for (const text of sentence.unsplittable) {
        if (reported.has(text)) continue
        reported.add(text)
        errors.push(`EARS の節に分けられない仕様の文: ${text}（${row.file}。キーワードとつなぎの語を記載ルールに合わせる）`)
      }
      if (sentence.isLeaf && !designKeys.has(sentence.key)) errors.push(`仕様の文に当たる行が無い: ${sentence.text}（${row.file}）`)
    }
    for (const designRow of designRows) {
      if (!specKeys.has(designRow.key)) errors.push(`仕様に無い行: ${designRow.id}（${row.file}:${designRow.line}。節と結果が仕様の文と一致しない）`)
    }

    // 仕様の表は、同じ列の表をテスト設計に写す。行ごとに照らす
    const specTableRows = listSpecTableRows(specSources[row.file] || '')
    const designTableRows = listDesignTableRows(designSources[row.file])
    const designTableKeys = new Set(designTableRows.map((designRow) => designRow.key))
    const specTableKeys = new Set(specTableRows.map((specRow) => specRow.key))
    for (const specRow of specTableRows) {
      if (!designTableKeys.has(specRow.key)) errors.push(`仕様の表の行に当たる行が無い: ${specRow.text}（${row.file}）`)
    }
    for (const designRow of designTableRows) {
      if (!specTableKeys.has(designRow.key)) errors.push(`仕様の表に無い行: ${designRow.id}（${row.file}:${designRow.line}。列とセルが仕様の表と一致しない）`)
    }
  }
  return errors
}

function checkStories(designs, specSources) {
  const errors = []
  for (const [file, markdown] of Object.entries(specSources)) {
    for (const problem of findSourceNoteProblems(markdown)) errors.push(`${problem}（${file}）`)
  }
  for (const { row, design } of designs) {
    const specStories = extractStoriesFromMarkdown(specSources[row.file] || '')
    const designStories = design.definitions.filter((definition) => definition.isStoryTable)
    const specKeys = new Set(specStories.map(normalizeStory))
    const designKeys = new Set(designStories.map((definition) => normalizeStory(definition.story || '')))
    for (const story of specStories) {
      if (!designKeys.has(normalizeStory(story))) errors.push(`仕様書のユーザーストーリーがテスト設計の表に無い: ${row.file} :: ${story}`)
    }
    const seen = new Map()
    for (const definition of designStories) {
      const key = normalizeStory(definition.story || '')
      if (seen.has(key)) errors.push(`同じユーザーストーリーが表に 2 行ある: ${seen.get(key)}・${definition.id}（${row.file}）`)
      else seen.set(key, definition.id)
      if (!specKeys.has(key)) {
        errors.push(`テスト設計のユーザーストーリーが仕様書に無い: ${definition.id}（${row.file}） :: ${definition.story}`)
      }
    }
  }
  return errors
}

/**
 * 既知の問題のテストの注記（support/spec.ts の knownIssue()）が指す先があるかを確かめる。
 * 「docs/ISSUES.md: <見出し>」は ISSUES.md の「## <見出し>」と一字一句同じ。「<仕様書>: <内容>」は仕様書があること
 */
export function checkKnownIssues(browserTests, { issuesSource, specFiles }) {
  const errors = []
  const headings = new Set([...issuesSource.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim()))
  const specSet = new Set(specFiles)
  for (const test of browserTests) {
    for (const description of test.knownIssues || []) {
      const [file, ...rest] = description.split(': ')
      const body = rest.join(': ')
      if (file === 'docs/ISSUES.md') {
        if (!headings.has(body)) errors.push(`ISSUES.md に無い見出しの既知の問題: ${body}（${test.file}:${test.title}）`)
      } else if (!specSet.has(file)) {
        errors.push(`既知の問題の注記の仕様書が無い: ${file}（${test.file}:${test.title}）`)
      }
    }
  }
  return errors
}

function checkTests({ definitionById, abolishedIds, outOfScopeIds, browserTests, pendingFiles }) {
  const errors = []
  const pendingIds = []
  const tagged = new Map()
  const checkTagId = (id, where) => {
    if (abolishedIds.has(id)) errors.push(`廃止した ID のタグ: ${id}（${where}）`)
    else if (!definitionById.has(id)) errors.push(`テスト設計に無い ID のタグ: ${id}（${where}）`)
    else if (outOfScopeIds.has(id)) errors.push(`対象外のルールにタグがある: ${id}（${where}）`)
  }

  for (const test of browserTests) {
    const where = `${test.file}:${test.title}`
    const ids = test.tags.map((tag) => tag.slice(1)).filter((tag) => tag.startsWith('TC-'))
    const hasStoryId = ids.some((id) => (id.match(ID_EXACT) || [])[3] === STORY_TYPE)
    const hasStoryTag = test.tags.includes(STORY_TAG)
    for (const id of ids) checkTagId(id, where)
    if (hasStoryId && !hasStoryTag) errors.push(`ユーザーストーリーの ID があるのに ${STORY_TAG} が無い: ${where}`)
    if (hasStoryTag && !hasStoryId) errors.push(`${STORY_TAG} があるのにユーザーストーリーの ID が無い: ${where}`)
    if (test.skipped) continue
    for (const id of ids) {
      if (!tagged.has(id)) tagged.set(id, [])
      tagged.get(id).push(where)
    }
  }

  for (const [id, definition] of definitionById) {
    if (outOfScopeIds.has(id)) continue
    if ((tagged.get(id) || []).length) continue
    if (pendingFiles.has(definition.file)) pendingIds.push(id)
    else errors.push(`テストの無いルール: ${id}（${definition.file}）`)
  }
  // 印を残したままテストが揃ったら、印を外させる（未作成のルールの有無が印で分かるようにするため）
  for (const file of pendingFiles) {
    if (!pendingIds.some((id) => definitionById.get(id).file === file)) {
      errors.push(`テスト未作成と書いたが、すべてのルールにテストがある: ${file}（「${PENDING_TESTS_LINE}」の行を消す）`)
    }
  }
  return { errors, pendingIds, tagged }
}
