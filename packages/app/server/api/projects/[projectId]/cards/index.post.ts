import { cards, images } from '@carble/db/schema'
import { createId } from '@paralleldrive/cuid2'
import { eq, max } from 'drizzle-orm'
import { z } from 'zod'
import { H3Error } from 'h3'

const createCardSchema = formDataSchema
  .pipe(z.object({
    image: imageFileSchema.optional(),
  }))
  .optional()

export default defineEventHandler(async (event) => {
  const project = await findProject()

  let data: z.infer<typeof createCardSchema>
  try {
    data = await validate(createCardSchema, await readFormData(event))
  } catch (err) {
    if (err instanceof H3Error) throw err
  }

  return await useDatabase().transaction(async (tx) => {
    const [result] = await tx
      .select({ max: max(cards.id) })
      .from(cards)
      .where(eq(cards.projectId, project.id))

    const [card] = await tx.insert(cards)
      .values({
        projectId: project.id,
        id: (result.max || 0) + 1,
      })
      .returning()

    if (data?.image) {
      const filename = `${createId()}.${data.image.ext}`

      await tx.insert(images).values({
        projectId: project.id,
        cardId: card.id,
        filename,
      })

      await useStorage('uploads/public/images').setItemRaw(filename, data.image.data)
    }

    await touchProjectUpdatedAt()

    return card
  })
})
