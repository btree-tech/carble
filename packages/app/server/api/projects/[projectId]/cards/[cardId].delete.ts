import { cards } from '@carble/db/schema'
import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async () => {
  const card = await findCard()
  return await useDatabase().transaction(async (tx) => {
    const images = await tx.query.images.findMany({
      columns: { filename: true },
      where: (t, { and, eq }) => and(
        eq(t.projectId, card.projectId),
        eq(t.cardId, card.id),
      ),
    })

    await tx.delete(cards)
      .where(and(
        eq(cards.projectId, card.projectId),
        eq(cards.id, card.id),
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
