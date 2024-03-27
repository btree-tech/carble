export default defineEventHandler(async (event) => {
  return await findProject({
    fields: {
      orderBy: ({ order }, { asc }) => asc(order),
    },
  })
})
