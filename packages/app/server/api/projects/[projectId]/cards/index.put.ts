import { cards } from '@carble/db/schema'
import type { SQL } from 'drizzle-orm'
import { eq, sql } from 'drizzle-orm'
import { createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'

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
