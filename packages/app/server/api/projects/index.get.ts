export default defineEventHandler(async () => {
  return await useDatabase().query.projects.findMany({
    orderBy: ({ updatedAt }, { desc }) => desc(updatedAt),
  })
})
