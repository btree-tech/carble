import { contents } from '@carble/db/schema'
import { z } from 'zod'

const updateContentSchema = z.object({
  body: z.string(),
})

export default defineEventHandler(async (event) => {
  const cardId = getRouterParam(event, 'cardId')
  const fieldId = getRouterParam(event, 'fieldId')

  const data = await validate(updateContentSchema, await readBody(event))

  const [content] = await useDatabase().insert(contents)
    .values({
      cardId: Number(cardId),
      fieldId: Number(fieldId),
      body: data.body,
    })
    .onConflictDoUpdate({
      target: [contents.cardId, contents.fieldId],
      set: {
        body: data.body,
        updatedAt: new Date(),
      },
    })
    .returning()

  return content
})
