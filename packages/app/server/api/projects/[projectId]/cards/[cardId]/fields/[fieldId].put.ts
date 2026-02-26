import { contents } from '@carble/db/schema'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const card = await findCard()
  const field = await findField()
  const data = await readValidatedBody(
    event,
    z.object({
      body: z.string(),
    }).parse,
  )

  return await useDatabase().transaction(async (tx) => {
    const [content] = await tx.insert(contents)
      .values({
        projectId: field.projectId,
        cardId: card.id,
        fieldId: field.id,
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

    await touchProjectUpdatedAt(tx)

    return content
  })
})
