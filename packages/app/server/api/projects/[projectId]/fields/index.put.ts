import { fields } from '@carble/db/schema'
import { eq } from 'drizzle-orm'
import { createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'

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
