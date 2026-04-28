import { usersToProjects } from '@carble/db/schema'
import z from 'zod'

export default defineEventHandler(async (event) => {
  const sessionUser = await useSessionUser()
  const project = await findProject({
    users: {
      where: ({ userId, role }, { and, eq }) => and(
        eq(userId, sessionUser.id),
        eq(role, 'owner'),
      ),
      limit: 1,
    },
  })
  if (!project.users.length) throw createError({ statusCode: 404 })

  const data = await readValidatedBody(
    event,
    z.object({
      username: z.string(),
      status: z.literal('invited'),
    }).parse,
  )

  const user = await useDatabase().query.users.findFirst({
    where: ({ username }, { eq }) => eq(username, data.username),
  })
  if (!user) throw createValidationError()

  await useDatabase().insert(usersToProjects)
    .values({
      userId: user.id,
      projectId: project.id,
      status: data.status,
    })
})
