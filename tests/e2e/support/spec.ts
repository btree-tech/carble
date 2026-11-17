/**
 * 既知の問題・実装との乖離の今の挙動を確かめるテスト（【既知の問題】【実装との乖離】）に付ける注記（docs/ISSUES.md、仕様書の「実装との乖離」）
 *
 *   test('【既知の問題】…', { annotation: [knownIssue('docs/ISSUES.md', '項目名で並び替えられない')] }, async () => { … })
 *
 * このテストには、テスト設計のルールのタグを付けない。ルールはテスト設計で `対象外` `乖離` にする（docs/test-design/README.md の「対象外の種類」）
 */
export function knownIssue(file: string, description: string): { type: string, description: string } {
  return { type: 'known-issue', description: `${file}: ${description}` }
}
