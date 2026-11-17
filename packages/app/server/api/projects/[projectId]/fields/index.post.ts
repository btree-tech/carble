import { fields } from '@carble/db/schema'
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'

defineRouteMeta({
  openAPI: {
    tags: ['fields'],
    summary: '項目の追加',
    // 入力: [場所, 名前, 型, 必須, 内容]
    'x-input': [
      ['パス', 'projectId', '整数', '必須', 'プロジェクトの ID'],
      ['本文（JSON）', 'name', '文字列', '必須', '項目名'],
    ],
    // 処理: [条件, 処理]
    'x-process': [
      ['（常に）', '項目を項目の末尾に追加する'],
      ['（常に）', 'プロジェクトの最終更新日時を更新する'],
    ],
    // 出力: [状態, 条件, 本文]
    'x-output': [
      ['200', '（常に）', '追加した項目'],
    ],
    // エラー: [状態, 条件]（ログイン・メンバー・ロールによるものは docs/product-spec/features/roles.md）
    'x-errors': [
      ['400', '本文が入力の形に合わない'],
      ['409', 'プロジェクトに取り込み待ち・取り込み中のインポートがある'],
    ],
  },
})

export default defineEventHandler(async (event) => {
  const project = await findProject()
  const data = await readValidatedBody(
    event,
    z.object({
      name: z.string(),
    }).parse,
  )

  return await useDatabase().transaction(async (tx) => {
    const maxOrder = tx.$with('max_order').as(
      tx
        .select({ max: sql<number>`ifnull(max(${fields.order}), 0)` })
        .from(fields)
        .where(eq(fields.projectId, project.id))
    )

    const [field] = await tx.with(maxOrder)
      .insert(fields)
      .values({
        ...data,
        projectId: project.id,
        order: sql`(select * from ${maxOrder}) + 1`,
      })
      .returning()

    await touchProjectUpdatedAt(tx)

    return field
  })
})
