import { fields } from '@carble/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

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
