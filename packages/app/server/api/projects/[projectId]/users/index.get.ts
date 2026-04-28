import { users, usersToProjects } from '@carble/db/schema'
import { and, asc, eq, isNull } from 'drizzle-orm'

export default defineEventHandler(async () => {
  const project = await findProject()

  const sessionUser = await useSessionUser()

  const isOwner = await useDatabase().query.usersToProjects.findFirst({
    where: ({ userId, projectId, role }, { and, eq }) => and(
      eq(userId, sessionUser.id),
      eq(projectId, project.id),
      eq(role, 'owner'),
    ),
  })

  return await useDatabase()
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      role: usersToProjects.role,
      status: usersToProjects.status,
    })
    .from(usersToProjects)
    .innerJoin(
      users,
      and(
        eq(users.id, usersToProjects.userId),
        eq(usersToProjects.projectId, project.id),
        isOwner ? undefined : isNull(usersToProjects.status),
      )
    )
    .orderBy(asc(usersToProjects.createdAt))
})
