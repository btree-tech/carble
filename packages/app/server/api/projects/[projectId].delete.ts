import { projects } from '@carble/db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async () => {
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

  return await useDatabase().transaction(async (tx) => {
    const images = await tx.query.images.findMany({
      columns: { filename: true },
      where: ({ projectId }, { eq }) => eq(projectId, project.id),
    })

    await tx.delete(projects)
      .where(eq(projects.id, project.id))

    await Promise.all(
      images.map(({ filename }) => [
        useStorage('uploads/public/images').removeItem(filename),
        useStorage('uploads/public/thumbs').removeItem(`${filename}.webp`),
      ])
      .flat()
    )
  })
})
