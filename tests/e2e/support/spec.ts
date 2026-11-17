import type { TestDetails } from '@playwright/test'

/**
 * テストが確かめる仕様書の項目を annotation に付ける
 *
 *   test('…', spec('pages/sign-in.md', 'ID・パスワードの入力 > **IF** ログインIDまたはパスワードが誤っている'), async () => { … })
 *
 * - 第 1 引数は docs/product-spec からのパス
 * - 以降は「節の見出し > 項目 > 入れ子の項目」の形。節の見出しが無い仕様書は項目から書く
 * - 各段は、仕様書の文言の書き出し（兄弟の項目と区別できる長さ）でよい。太字やリンクの記法は外して比べる
 * - 別の仕様書の項目も同じテストで確かめる場合は、項目を「features/xxx.md > …」の形で書く
 * - 対応の確認は scripts/check-spec-coverage.mjs で行う
 */
export function spec(file: string, ...items: string[]): TestDetails {
  return {
    annotation: items.map((item) => ({
      type: 'spec',
      description: /^(pages|features)\/[\w-]+\.md > /.test(item) ? item : `${file} > ${item}`,
    })),
  }
}

/** 既知の問題・実装との乖離のテストに付ける注記（docs/ISSUES.md、仕様書の「実装との乖離」） */
export function knownIssue(file: string, description: string): { type: string, description: string } {
  return { type: 'known-issue', description: `${file}: ${description}` }
}

/**
 * spec() に既知の問題の注記を足す
 *
 *   test('【既知の問題】…', withIssue(spec('pages/table-view.md', '並び替え > …'), knownIssue('docs/ISSUES.md', '項目名で並び替えられない')), async () => { … })
 */
export function withIssue(details: TestDetails, ...issues: { type: string, description: string }[]): TestDetails {
  const annotation = details.annotation === undefined ? [] : Array.isArray(details.annotation) ? details.annotation : [details.annotation]
  return { ...details, annotation: [...annotation, ...issues] }
}
