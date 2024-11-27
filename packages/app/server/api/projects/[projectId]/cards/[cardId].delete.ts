import { cards } from '@carble/db/schema'
import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'projectId')
  const cardId = getRouterParam(event, 'cardId')

  return await useDatabase().transaction(async (tx) => {
    const images = await tx.query.images.findMany({
      columns: { filename: true },
      where: (t, { and, eq }) => and(
        eq(t.projectId, Number(projectId)),
        eq(t.cardId, Number(cardId)),
      ),
    })

    await tx.delete(cards)
      .where(and(
        eq(cards.projectId, Number(projectId)),
        eq(cards.id, Number(cardId)),
      ))

    await touchProjectUpdatedAt()

    await Promise.all(
      images.map(({ filename }) => [
        useStorage('uploads/public/images').removeItem(filename),
        useStorage('uploads/public/thumbs').removeItem(`${filename}.webp`),
      ])
      .flat()
    )
  })
})
