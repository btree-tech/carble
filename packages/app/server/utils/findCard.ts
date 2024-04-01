
export default async function() {
  const projectId = getRouterParam(useEvent(), 'projectId')
  const cardId = getRouterParam(useEvent(), 'cardId')

  const card = await useDatabase().query.cards.findFirst({
    where: (t, { eq, and }) => and(
      eq(t.id, Number(cardId)),
      eq(t.projectId, Number(projectId)),
    ),
  })

  if (!card) throw createError({ statusCode: 404 })

  return card
}
