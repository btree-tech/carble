export default defineEventHandler(async () => {
  const sessionUser = await useSessionUser()

  return await findProject({
    fields: {
      orderBy: ({ order }, { asc }) => asc(order),
    },
    cards: {
      columns: {
        id: true,
      },
    },
    users: {
      columns: {
        role: true,
      },
      where: ({ userId }, { eq }) => eq(userId, sessionUser.id),
      limit: 1,
    },
  })
})
