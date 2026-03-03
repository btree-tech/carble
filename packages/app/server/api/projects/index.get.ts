import { usersToProjects } from '@carble/db/schema'

export default defineEventHandler(async (event) => {
  const user = await useSessionUser()

  const data = await getValidatedQuery(
    event,
    createSelectSchema(usersToProjects, {
      status: (s) => s.nullable().default(null),
    }).pick({
      status: true,
    }).parse,
  )

  return useDatabase().transaction(async (tx) => {
    const projetIds = await tx.query.usersToProjects.findMany({
      where: ({ userId, status }, { and, eq, isNull }) => and(
        eq(userId, user.id),
        data.status ? eq(status, data.status) : isNull(status),
      ),
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
