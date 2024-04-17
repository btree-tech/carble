import { projects } from '@carble/db/schema'
import { eq } from 'drizzle-orm'

export default async function() {
  const projectId = getRouterParam(useEvent(), 'projectId')
  if (!projectId) return

  await useDatabase().update(projects)
    .set({
      updatedAt: new Date(),
    })
    .where(eq(projects.id, Number(projectId)))
}
