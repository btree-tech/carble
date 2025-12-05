export default defineEventHandler(async () => {
  return await useDatabase().query.projects.findMany({
    orderBy: ({ updatedAt }, { desc }) => desc(updatedAt),
    with: {
      imports: {
        where: ({ status }, { inArray }) => inArray(status, ['OPEN', 'IN_PROGRESS']),
      },
    },
  })
})
