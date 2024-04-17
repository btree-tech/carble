import { cards } from '@carble/db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const cardId = getRouterParam(event, 'cardId')

  return await useDatabase().transaction(async (tx) => {
    const images = await tx.query.images.findMany({
      columns: { filename: true },
      where: (t, { eq }) => eq(t.cardId, Number(cardId)),
    })

    await tx.delete(cards)
      .where(eq(cards.id, Number(cardId)))

    await touchProjectUpdatedAt()

    await Promise.all(
      images.map(({ filename }) => useStorage('uploads/public/images').removeItem(filename))
    )
  })
})
