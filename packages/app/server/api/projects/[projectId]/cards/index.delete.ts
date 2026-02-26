import { cards } from '@carble/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { createSelectSchema } from 'drizzle-zod'
import z from 'zod'

export default defineEventHandler(async (event) => {
  const project = await findProject({
    cards: {
      columns: {
        id: true,
      },
    },
  })
  const data = await readValidatedBody(
    event,
    z.object({
      ids: z.array(createSelectSchema(cards).shape.id).superRefine((value, context) => {
        const ids = project.cards.map(({ id }) => id)
        if (value.some((id) => !ids.includes(id))) {
          context.addIssue({
            code: 'invalid_value',
            values: value,
          })
        }
      })
    }).parse,
  )
  return await useDatabase().transaction(async (tx) => {
    const images = await tx.query.images.findMany({
      columns: { filename: true },
      where: (t, { and, eq, inArray }) => and(
        eq(t.projectId, project.id),
        inArray(t.cardId, data.ids),
      ),
    })

    await tx.delete(cards)
      .where(and(
        eq(cards.projectId, project.id),
        inArray(cards.id, data.ids),
      ))

    await touchProjectUpdatedAt(tx)

    await Promise.all(
      images.map(({ filename }) => [
        useStorage('uploads/public/images').removeItem(filename),
        useStorage('uploads/public/thumbs').removeItem(`${filename}.webp`),
      ])
      .flat()
    )
  })
})
