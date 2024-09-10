import { images } from '@carble/db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const imageId = getRouterParam(event, 'imageId')

  return await useDatabase().transaction(async (tx) => {
    const image = await tx.query.images.findFirst({
      where: ({ id }, { eq }) => eq(id, Number(imageId))
    })
    if (!image) throw createError({ statusCode: 404 })

    await tx.delete(images)
      .where(eq(images.id, Number(imageId)))

    await touchProjectUpdatedAt()

    await useStorage('uploads/public/images').removeItem(image.filename)
    await useStorage('uploads/public/thumbs').removeItem(`${image.filename}.webp`)
  })
})
