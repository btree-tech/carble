import { imports } from '@carble/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const updateImportSchema = z.object({
  notified: z.literal(true),
})

export default defineEventHandler(async (event) => {
  const importData = await findImport()
  const data = await readValidatedBody(event, updateImportSchema.parse)

  const [updated] = await useDatabase().update(imports)
    .set({
      notifiedAt: data.notified ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(imports.id, importData.id))
    .returning()

  return updated
})
