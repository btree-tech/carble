import { images } from '@carble/db/schema'
import { createId } from '@paralleldrive/cuid2'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const card = await findCard()
  const data = await readValidatedFormData(
    event,
    z.object({
      image: imageFileSchema,
    }).parseAsync
  )

  const filename = `${createId()}.${data.image.ext}`

  return await useDatabase().transaction(async (tx) => {
    const [image] = await tx.insert(images)
      .values({
        projectId: card.projectId,
        cardId: card.id,
        filename,
      })
      .returning()

    await touchProjectUpdatedAt(tx)

    await useStorage('uploads/public/images').setItemRaw(filename, Buffer.from(await data.image.data.arrayBuffer()))

    return image
  })
})
