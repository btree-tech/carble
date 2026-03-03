import { usersToProjects } from '@carble/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import z from 'zod'

export default defineEventHandler(async (event) => {
  const data = await getValidatedRouterParams(
    event,
    z.object({
      userId: z.string(),
    }).parse,
  )
  const sessionUser = await useSessionUser()
  const targetIsSelf = data.userId === sessionUser.id
  const project = await findProject(targetIsSelf
    ? {
        users: {
          where: ({ userId, role, status }, { and, eq, isNull }) => and(
            eq(userId, data.userId),
            isNull(role),
            eq(status, 'invited'),
          ),
          limit: 1,
        },
      }
    : {
        users: {
          where: ({ userId, role }, { or, and, eq, isNull }) =>or(
            and(
              eq(userId, data.userId),
              isNull(role),
            ),
            and(
              eq(userId, sessionUser.id),
              eq(role, 'owner'),
            ),
          ),
          limit: 2,
        },
      }
  )
  if (project.users.length < 1 || (!targetIsSelf && project.users.length < 2)) throw createError({ statusCode: 404 })

  await useDatabase()
    .delete(usersToProjects)
    .where(and(
      eq(usersToProjects.projectId, project.id),
      eq(usersToProjects.userId, data.userId),
      isNull(usersToProjects.role),
    ))
})
