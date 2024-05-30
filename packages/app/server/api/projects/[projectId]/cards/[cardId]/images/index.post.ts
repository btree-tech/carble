import { images } from '@carble/db/schema'
import { createId } from '@paralleldrive/cuid2'
import { z } from 'zod'

const createImageSchema = formDataSchema.pipe(z.object({
  image: imageFileSchema,
}))

export default defineEventHandler(async (event) => {
  const data = await validate(createImageSchema, await readFormData(event))

  const projectId = getRouterParam(event, 'projectId')
  const cardId = getRouterParam(event, 'cardId')

  const filename = `${createId()}.${data.image.ext}`

  return await useDatabase().transaction(async (tx) => {
    const [image] = await tx.insert(images)
      .values({
        projectId: Number(projectId),
        cardId: Number(cardId),
        filename,
      })
      .returning()

    await touchProjectUpdatedAt()

    await useStorage('uploads/public/images').setItemRaw(filename, data.image.data)

    return image
  })
})
