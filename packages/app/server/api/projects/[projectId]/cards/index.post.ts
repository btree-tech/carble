import { cards, images } from '@carble/db/schema'
import { createId } from '@paralleldrive/cuid2'
import { eq, max } from 'drizzle-orm'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const project = await findProject()
  const data = getRequestHeader(event, 'content-type')?.startsWith('multipart/form-data')
    ? await readValidatedFormData(
        event,
        z.object({
          image: imageFileSchema.optional(),
        }).parseAsync
      )
    : {}

  return await useDatabase().transaction(async (tx) => {
    const [{
      maxCardId,
      maxOrder,
    }] = await tx
      .select({
        maxCardId: max(cards.id),
        maxOrder: max(cards.order),
      })
      .from(cards)
      .where(eq(cards.projectId, project.id))

    const [card] = await tx.insert(cards)
      .values({
        projectId: project.id,
        id: (maxCardId ?? 0) + 1,
        order: (maxOrder ?? 0) + 1,
      })
      .returning()

    const cardImages: typeof images.$inferSelect[] = []
    if (data?.image) {
      const filename = `${createId()}.${data.image.ext}`

      const [image] = await tx.insert(images)
        .values({
          projectId: project.id,
          cardId: card.id,
          filename,
        })
        .returning()
      cardImages.push(image)

      await useStorage('uploads/public/images').setItemRaw(filename, Buffer.from(await data.image.data.arrayBuffer()))

      await touchProjectUpdatedAt(tx)
    }

    return {
      ...card,
      images: cardImages,
    }
  })
})
