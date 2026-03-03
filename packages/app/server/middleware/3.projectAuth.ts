export default defineEventHandler(async (event) => {
  const projectId = event.path.match(/\/projects\/([0-9]+)/)?.at(1)
  if (!projectId) return

  const user = await useSessionUser()

  const project = await useDatabase().query.usersToProjects.findFirst({
    where: (t, { and, eq, isNull }) => and(
      eq(t.userId, user.id),
      eq(t.projectId, Number(projectId)),
      event.path === `/api/projects/${projectId}/users/${user.id}`
        ? undefined
        : isNull(t.status),
    ),
  })
  if (!project) throw createError({ statusCode: 404 })
})
