import { images } from '@carble/db/schema'
import { createId } from '@paralleldrive/cuid2'
import { extension } from 'mime-types'

export default defineEventHandler(async (event) => {
  const body = await readMultipartFormData(event)
  const file = body?.find((data) => data.name === 'image')!

  const projectId = getRouterParam(event, 'projectId')
  const cardId = getRouterParam(event, 'cardId')

  const filename = `${createId()}.${extension(file.type!)}`

  return await useDatabase().transaction(async (tx) => {
    const [image] = await tx.insert(images)
      .values({
        projectId: Number(projectId),
        cardId: Number(cardId),
        filename,
      })
      .returning()

    await useStorage('uploads/public/images').setItemRaw(filename, file.data)

    return image
  })
})
