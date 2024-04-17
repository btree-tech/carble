import { projects } from '@carble/db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async () => {
  const project = await findProject()

  return await useDatabase().transaction(async (tx) => {
    const images = await tx.query.images.findMany({
      columns: { filename: true },
      where: ({ projectId }, { eq }) => eq(projectId, project.id),
    })

    await tx.delete(projects)
      .where(eq(projects.id, project.id))

    await Promise.all(
      images.map(({ filename }) => useStorage('uploads/public/images').removeItem(filename))
    )
  })
})
