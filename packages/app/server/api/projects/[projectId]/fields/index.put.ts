import { fields } from '@carble/db/schema'
import { eq } from 'drizzle-orm'
import { createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'

defineRouteMeta({
  openAPI: {
    tags: ['fields'],
    summary: '項目の並び替え',
    // 入力: [場所, 名前, 型, 必須, 内容]
    'x-input': [
      ['パス', 'projectId', '整数', '必須', 'プロジェクトの ID'],
      ['本文（JSON）', '（配列）', 'id・order の組の配列', '必須', 'プロジェクトの全項目の ID と並び順'],
    ],
    // 処理: [条件, 処理]
    'x-process': [
      ['（常に）', '各項目の並び順を送った値にする'],
      ['（常に）', 'プロジェクトの最終更新日時を更新する'],
    ],
    // 出力: [状態, 条件, 本文]
    'x-output': [
      ['204', '（常に）', 'なし'],
    ],
    // エラー: [状態, 条件]（ログイン・メンバー・ロールによるものは docs/product-spec/features/roles.md）
    'x-errors': [
      ['400', '本文が入力の形に合わない'],
      ['400', '送った項目の数がプロジェクトの項目の数と違う'],
      ['400', '送った並び順が重なっている'],
      ['409', 'プロジェクトに取り込み待ち・取り込み中のインポートがある'],
    ],
  },
})

export default defineEventHandler(async (event) => {
  const project = await findProject()
  const data = await readValidatedBody(
    event,
    z.array(createSelectSchema(fields).pick({
      id: true,
      order: true,
    }))
    .superRefine(async (value, context) => {
      const count = await useDatabase().$count(fields, eq(fields.projectId, project.id))
      if (count !== value.length) {
        context.addIssue({
          code: 'too_big',
          origin: 'array',
          maximum: count,
          exact: true,
          inclusive: true,
        })
      }

      if (value.length !== new Set(value.map((v) => v.order)).size) {
        context.addIssue({
          code: 'custom',
          message: `No duplicates allowed.`,
        })
      }
    }).parseAsync,
  )

  return await useDatabase().transaction(async (tx) => {
    for await (const d of data) {
      await tx.update(fields)
        .set({
          order: d.order,
          updatedAt: new Date(),
        })
        .where(eq(fields.id, d.id))
    }

    await touchProjectUpdatedAt(tx)
  })
})
