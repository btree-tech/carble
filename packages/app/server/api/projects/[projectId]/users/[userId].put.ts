import { usersToProjects } from '@carble/db/schema'
import { and, eq } from 'drizzle-orm'
import z from 'zod'

export default defineEventHandler(async (event) => {
  const sessionUser = await useSessionUser()
  if (sessionUser.id !== getRouterParam(event, 'userId')) throw createError({ statusCode: 404 })
  const project = await findProject({
    users: {
      where: ({ userId, status }, { and, eq }) => and(
        eq(userId, sessionUser.id),
        eq(status, 'invited'),
      ),
      limit: 1,
    },
  })
  if (!project.users.length) throw createError({ statusCode: 404 })

  const data = await readValidatedBody(
    event,
    z.object({
      status: z.null(),
    }).parse,
  )

  await useDatabase().update(usersToProjects)
    .set({
      userId: sessionUser.id,
      projectId: project.id,
      status: data.status,
    })
    .where(and(
      eq(usersToProjects.userId, sessionUser.id),
      eq(usersToProjects.projectId, project.id),
    ))
})
