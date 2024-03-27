import { connect } from '@carble/db'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'projectId')
  const cardId = getRouterParam(event, 'cardId')

  return await connect().query.cards.findFirst({
    where: (t, { eq, and }) => and(
      eq(t.id, Number(cardId)),
      eq(t.projectId, Number(projectId)),
    ),
    with: {
      contents: true,
      images: {
        orderBy: ({ createdAt }, { asc }) => asc(createdAt),
      },
    },
  })
})
