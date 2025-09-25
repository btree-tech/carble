import { fields } from '@carble/db/schema'
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'

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
