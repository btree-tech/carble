import { connect } from '@carble/db'
import { fields } from '@carble/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const updateFieldSchema = z.union([
  z.object({
    name: z.string(),
  }),
  z.object({
    isVisible: z.boolean(),
  }),
])

export default defineEventHandler(async (event) => {
  const field = await findField()
  const data = await validate(updateFieldSchema, await readBody(event))

  return await connect().update(fields)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(fields.id, field.id))
})
