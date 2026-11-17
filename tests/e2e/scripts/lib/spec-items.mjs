// 仕様書（docs/product-spec）の「外部仕様（What）」から項目を読み出す
//
// 項目は、箇条書きの 1 行と、表の 1 行（見出し行と区切り行を除く）。
// 入れ子の箇条書きと、箇条書きの下に字下げした表は、親の項目の子とする。
// 「### 見出し」は節として、項目の親にする。
// 文言は太字・リンク・コードの記法を外して比べる。表の行はセルを「 | 」でつなぐ

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** 太字・リンク・コードの記法を外す */
export function normalize(text) {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 1 つの仕様書の項目の木
 * @returns {{ text: string, line: number, children: any[], kind: 'section' | 'item' | 'row' }[]}
 */
export function parseSpec(source) {
  const lines = source.split('\n')
  const start = lines.findIndex((line) => /^## 外部仕様/.test(line))
  if (start < 0) return []
  const roots = []
  let section = null
  // 字下げの深さごとの親（箇条書き）
  let stack = []

  const container = () => (section ? section.children : roots)

  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]
    if (/^## /.test(line)) break

    const heading = line.match(/^### (.+)$/)
    if (heading) {
      section = { kind: 'section', text: normalize(heading[1]), line: i + 1, children: [] }
      roots.push(section)
      stack = []
      continue
    }

    const bullet = line.match(/^(\s*)- (.+)$/)
    if (bullet) {
      const indent = bullet[1].length
      const node = { kind: 'item', text: normalize(bullet[2]), line: i + 1, children: [], indent }
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop()
      const parent = stack[stack.length - 1]
      ;(parent ? parent.children : container()).push(node)
      stack.push(node)
      continue
    }

    const row = line.match(/^(\s*)\|(.+)\|\s*$/)
    if (row) {
      const indent = row[1].length
      const cells = row[2].split('|').map((cell) => normalize(cell))
      // 区切り行（|---|---|）
      if (cells.every((cell) => /^:?-+:?$/.test(cell))) continue
      // 見出し行（次の行が区切り行）
      const next = lines[i + 1] ?? ''
      if (/^\s*\|(\s*:?-+:?\s*\|)+\s*$/.test(next)) continue
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop()
      const parent = stack[stack.length - 1]
      ;(parent ? parent.children : container()).push({ kind: 'row', text: cells.join(' | '), line: i + 1, children: [] })
    }
  }
  return roots
}

/** 仕様書ごとの項目の木（pages と features。info は外部仕様ではないので読まない） */
export function loadSpecs(productSpecDir) {
  const specs = new Map()
  for (const dir of ['pages', 'features']) {
    for (const name of readdirSync(join(productSpecDir, dir)).filter((n) => n.endsWith('.md')).sort()) {
      const items = parseSpec(readFileSync(join(productSpecDir, dir, name), 'utf8'))
      // 「## 外部仕様」の見出しが変わるなどして 1 件も読めないときに、黙って通らないようにする
      if (!items.length) throw new Error(`docs/product-spec/${dir}/${name} の「## 外部仕様」から項目を 1 件も読めませんでした`)
      specs.set(`${dir}/${name}`, items)
    }
  }
  return specs
}

/** 木を平らにして、各項目の「仕様書 > 段 > 段」の表記を付ける */
export function flatten(file, nodes, path = []) {
  const result = []
  for (const node of nodes) {
    const nodePath = [...path, node.text]
    result.push({ file, node, path: nodePath, key: [file, ...nodePath].join(' > ') })
    result.push(...flatten(file, node.children, nodePath))
  }
  return result
}

/**
 * 「仕様書 > 段 > 段」の参照（annotation・対象外リスト）を、項目に解決する
 * 各段は文言の書き出しでよい。兄弟のうち書き出しが一致するものが 1 つでなければエラー（完全一致があればそれを選ぶ）
 * @returns {{ node?: any, error?: string }}
 */
export function resolve(specs, reference) {
  const [file, ...segments] = reference.split(' > ').map((s) => s.trim())
  const roots = specs.get(file)
  if (!roots) return { error: `仕様書がありません: ${file}` }
  if (!segments.length) return { error: `項目がありません: ${reference}` }
  let nodes = roots
  let node
  for (const raw of segments) {
    const segment = normalize(raw)
    const exact = nodes.filter((n) => n.text === segment)
    const prefixed = nodes.filter((n) => n.text.startsWith(segment))
    const matched = exact.length === 1 ? exact : prefixed
    if (matched.length === 0) return { error: `「${raw}」に当たる項目がありません: ${reference}` }
    if (matched.length > 1) return { error: `「${raw}」に当たる項目が ${matched.length} 個あります（書き出しを長くしてください）: ${reference}` }
    node = matched[0]
    nodes = node.children
  }
  return { node }
}
