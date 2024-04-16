export default defineEventHandler(async () => {
  return await findCard({
    contents: true,
    images: {
      orderBy: ({ createdAt }, { asc }) => asc(createdAt),
    },
  })
})
