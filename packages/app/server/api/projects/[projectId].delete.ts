import { projects } from '@carble/db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async () => {
  const project = await findProject()

  return await useDatabase().delete(projects)
    .where(eq(projects.id, project.id))
})
