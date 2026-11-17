import { fields } from '@carble/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

defineRouteMeta({
  openAPI: {
    tags: ['fields'],
    summary: '項目の変更',
    // 入力: [場所, 名前, 型, 必須, 内容]
    'x-input': [
      ['パス', 'projectId', '整数', '必須', 'プロジェクトの ID'],
      ['パス', 'fieldId', '整数', '必須', '項目の ID'],
      ['本文（JSON）', 'name', '文字列', 'name・isVisible のどちらか', '新しい項目名'],
      ['本文（JSON）', 'isVisible', '真偽値', 'name・isVisible のどちらか', '項目を表示するか'],
    ],
    // 処理: [条件, 処理]
    'x-process': [
      ['name がある', '項目名を name にする'],
      ['isVisible がある', '項目の表示・非表示を isVisible にする'],
      ['（常に）', 'プロジェクトの最終更新日時を更新する'],
    ],
    // 出力: [状態, 条件, 本文]
    'x-output': [
      ['204', '（常に）', 'なし'],
    ],
    // エラー: [状態, 条件]（ログイン・メンバー・ロールによるものは docs/product-spec/features/roles.md）
    'x-errors': [
      ['400', '本文が入力の形に合わない'],
      ['404', 'fieldId の項目がプロジェクトに無い'],
      ['409', 'プロジェクトに取り込み待ち・取り込み中のインポートがある'],
    ],
  },
})

export default defineEventHandler(async (event) => {
  const field = await findField()
  const data = await readValidatedBody(
    event,
    z.union([
      z.object({
        name: z.string(),
      }),
      z.object({
        isVisible: z.boolean(),
      }),
    ]).parse,
  )

  return await useDatabase().transaction(async (tx) => {
    await tx.update(fields)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(fields.id, field.id))

    await touchProjectUpdatedAt(tx)
  })
})
