export default defineEventHandler(async () => {
  return await findProject({
    fields: {
      orderBy: ({ order }, { asc }) => asc(order),
    },
  })
})
