import { cards } from '@carble/db/schema'
import type { SQL } from 'drizzle-orm'
import { eq, sql } from 'drizzle-orm'
import { createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'

defineRouteMeta({
  openAPI: {
    tags: ['cards'],
    summary: 'カードの並び替え',
    // 入力: [場所, 名前, 型, 必須, 内容]
    'x-input': [
      ['パス', 'projectId', '整数', '必須', 'プロジェクトの ID'],
      ['本文（JSON）', '（配列）', 'id・order の組の配列', '必須', 'プロジェクトの全カードの ID と並び順'],
    ],
    // 処理: [条件, 処理]
    'x-process': [
      ['（常に）', '各カードの並び順を送った値にする'],
      ['（常に）', 'プロジェクトの最終更新日時を更新する'],
    ],
    // 出力: [状態, 条件, 本文]
    'x-output': [
      ['204', '（常に）', 'なし'],
    ],
    // エラー: [状態, 条件]（ログイン・メンバー・ロールによるものは docs/product-spec/features/roles.md）
    'x-errors': [
      ['400', '本文が入力の形に合わない'],
      ['400', '送ったカードの数がプロジェクトのカードの数と違う'],
      ['409', 'プロジェクトに取り込み待ち・取り込み中のインポートがある'],
    ],
  },
})

export default defineEventHandler(async (event) => {
  const project = await findProject()
  const data = await readValidatedBody(
    event,
    z.array(createSelectSchema(cards).pick({
      id: true,
      order: true,
    }))
    .superRefine(async (value, context) => {
      const count = await useDatabase().$count(cards, eq(cards.projectId, project.id))
      if (count !== value.length) {
        context.addIssue({
          code: 'too_big',
          origin: 'array',
          maximum: count,
          exact: true,
          inclusive: true,
        })
      }
    }).parseAsync,
  )

  const queries: SQL[] = [
    sql`update ${cards} set "order" = case ${cards.id}`,
  ]
  data.forEach(({ id, order }) => {
    queries.push(sql`when ${id} then ${order}`)
  })
  queries.push(
    sql`end`,
    sql`where ${cards.projectId} = ${project.id}`
  )

  return await useDatabase().transaction(async (tx) => {
    await tx.run(sql.join(queries, sql` `))
    await touchProjectUpdatedAt(tx)
  })
})
