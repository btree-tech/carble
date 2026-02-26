import { images } from '@carble/db/schema'
import { eq } from 'drizzle-orm'
import z from 'zod'

export default defineEventHandler(async (event) => {
  await findCard()

  const {
    imageId,
  } = await getValidatedRouterParams(
    event,
    z.object({
      imageId: z.coerce.number(),
    }).parse,
  )

  return await useDatabase().transaction(async (tx) => {
    const image = await tx.query.images.findFirst({
      where: ({ id }, { eq }) => eq(id, imageId)
    })
    if (!image) throw createError({ statusCode: 404 })

    await tx.delete(images)
      .where(eq(images.id, imageId))

    await touchProjectUpdatedAt(tx)

    await useStorage('uploads/public/images').removeItem(image.filename)
    await useStorage('uploads/public/thumbs').removeItem(`${image.filename}.webp`)
  })
})
