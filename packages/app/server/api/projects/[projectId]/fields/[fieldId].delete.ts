import { fields } from '@carble/db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async () => {
  const field = await findField()

  return await useDatabase().transaction(async (tx) => {
    await tx.delete(fields)
      .where(eq(fields.id, field.id))

    await touchProjectUpdatedAt(tx)
  })
})
