import { contents } from '@carble/db/schema'
import { z } from 'zod'

const updateContentSchema = z.object({
  body: z.string(),
})

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'projectId')
  const cardId = getRouterParam(event, 'cardId')
  const fieldId = getRouterParam(event, 'fieldId')

  const data = await validate(updateContentSchema, await readBody(event))

  return await useDatabase().transaction(async (tx) => {
    const [content] = await tx.insert(contents)
      .values({
        projectId: Number(projectId),
        cardId: Number(cardId),
        fieldId: Number(fieldId),
        body: data.body,
      })
      .onConflictDoUpdate({
        target: [contents.projectId, contents.cardId, contents.fieldId],
        set: {
          body: data.body,
          updatedAt: new Date(),
        },
      })
      .returning()

    await touchProjectUpdatedAt()

    return content
  })
})
