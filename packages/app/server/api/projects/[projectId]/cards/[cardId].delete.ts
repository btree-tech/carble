import { connect } from '@carble/db'
import { cards } from '@carble/db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const cardId = getRouterParam(event, 'cardId')

  return await connect().delete(cards)
    .where(eq(cards.id, Number(cardId)))
})
