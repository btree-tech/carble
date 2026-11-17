import { fields } from '@carble/db/schema'
import { eq } from 'drizzle-orm'

defineRouteMeta({
  openAPI: {
    tags: ['fields'],
    summary: '項目の削除',
    // 入力: [場所, 名前, 型, 必須, 内容]
    'x-input': [
      ['パス', 'projectId', '整数', '必須', 'プロジェクトの ID'],
      ['パス', 'fieldId', '整数', '必須', '項目の ID'],
    ],
    // 処理: [条件, 処理]
    'x-process': [
      ['（常に）', '項目を、各カードのその項目の値とともに削除する'],
      ['（常に）', 'プロジェクトの最終更新日時を更新する'],
    ],
    // 出力: [状態, 条件, 本文]
    'x-output': [
      ['204', '（常に）', 'なし'],
    ],
    // エラー: [状態, 条件]（ログイン・メンバー・ロールによるものは docs/product-spec/features/roles.md）
    'x-errors': [
      ['404', 'fieldId の項目がプロジェクトに無い'],
      ['409', 'プロジェクトに取り込み待ち・取り込み中のインポートがある'],
    ],
  },
})

export default defineEventHandler(async () => {
  const field = await findField()

  return await useDatabase().transaction(async (tx) => {
    await tx.delete(fields)
      .where(eq(fields.id, field.id))

    await touchProjectUpdatedAt(tx)
  })
})
