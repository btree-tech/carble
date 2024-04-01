import { fields } from '@carble/db/schema'
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'

const createFieldSchema = z.object({
  name: z.string(),
})

export default defineEventHandler(async (event) => {
  const project = await findProject()

  const data = await validate(createFieldSchema, await readBody(event))

  const db = useDatabase()

  const maxOrder = db.$with('max_order').as(
    db
      .select({ max: sql<number>`ifnull(max(${fields.order}), 0)` })
      .from(fields)
      .where(eq(fields.projectId, project.id))
  )

  const [field] = await db.with(maxOrder)
    .insert(fields)
    .values({
      ...data,
      projectId: project.id,
      order: sql`(select * from ${maxOrder}) + 1`,
    })
    .returning()

  return field
})
