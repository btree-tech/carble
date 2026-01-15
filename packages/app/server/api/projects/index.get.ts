export default defineEventHandler(async () => {
  const user = await useSessionUser()

  return useDatabase().transaction(async (tx) => {
    const projetIds = await tx.query.usersToProjects.findMany({
      where: ({ userId }, { eq }) => eq(userId, user.id),
    })

    return await tx.query.projects.findMany({
      where: ({ id }, { inArray }) => inArray(id, projetIds.map(({ projectId }) => projectId)),
      orderBy: ({ updatedAt }, { desc }) => desc(updatedAt),
      with: {
        imports: {
          where: ({ status }, { inArray }) => inArray(status, ['OPEN', 'IN_PROGRESS']),
        },
      },
    })
  })
})
