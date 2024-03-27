import { connect } from '@carble/db'
import { fields } from '@carble/db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async () => {
  const field = await findField()

  return await connect().delete(fields)
    .where(eq(fields.id, field.id))
})
