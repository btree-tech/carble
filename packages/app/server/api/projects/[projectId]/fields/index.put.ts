import { fields } from '@carble/db/schema'
import { count, eq } from 'drizzle-orm'
import { createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'

const updateFieldsSchema = z.array(createSelectSchema(fields).pick({
  id: true,
  order: true,
}))
.superRefine(async (value, context) => {
  const [result] = await useDatabase()
    .select({ count: count(fields.id) })
    .from(fields)
    .where(eq(fields.projectId, Number(getRouterParam(useEvent(), 'projectId'))))
  if (result.count !== value.length) {
    context.addIssue({
      code: z.ZodIssueCode.too_big,
      type: 'array',
      maximum: result.count,
      exact: true,
      inclusive: true,
    })
  }

  if (value.length !== new Set(value.map((v) => v.order)).size) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `No duplicates allowed.`,
    })
  }
})

export default defineEventHandler(async (event) => {
  const data = await validate(updateFieldsSchema, await readBody(event))

  return await useDatabase().transaction(async (tx) => {
    for await (const d of data) {
      await tx.update(fields)
        .set({
          order: d.order,
          updatedAt: new Date(),
        })
        .where(eq(fields.id, d.id))
    }

    await touchProjectUpdatedAt()
  })
})
