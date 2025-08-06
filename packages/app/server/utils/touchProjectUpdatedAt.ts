import { projects } from '@carble/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const schema = z.object({
  projectId: z.coerce.number(),
})

export default async function(projectId?: number) {
  projectId ??= (await getValidatedRouterParams(useEvent(), schema.parse)).projectId
  if (!projectId) return

  await useDatabase().update(projects)
    .set({
      updatedAt: new Date(),
    })
    .where(eq(projects.id, Number(projectId)))
}
