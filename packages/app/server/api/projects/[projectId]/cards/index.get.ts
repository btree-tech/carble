
export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'projectId')

  return await useDatabase().query.cards.findMany({
    where: (t, { eq }) => eq(t.projectId, Number(projectId)),
    orderBy: ({ id }, { asc }) => asc(id),
    with: {
      contents: true,
      images: {
        orderBy: ({ createdAt }, { asc }) => asc(createdAt),
      },
    },
  })
})
