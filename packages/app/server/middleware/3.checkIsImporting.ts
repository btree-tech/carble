export default defineEventHandler(async (event) => {
  const projectId = event.path.match(/\/projects\/([0-9]+)\//)?.at(1)
  if (!projectId) {
    return
  }
  if (event.path.includes('/imports')) {
    return
  }

  const importing = await useDatabase().query.imports.findFirst({
    where: (t, { eq, inArray, and }) => and(
      eq(t.projectId, Number(projectId)),
      inArray(t.status, ['OPEN', 'IN_PROGRESS']),
    ),
  })
  if (importing) {
    throw createError({ statusCode: 409 })
  }
})
