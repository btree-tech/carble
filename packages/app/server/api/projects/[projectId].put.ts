import { projects } from '@carble/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const project = await findProject()
  const data = await readValidatedBody(
    event,
    z.object({
      name: z.string(),
    }).parse,
  )

  const [updated] = await useDatabase().update(projects)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, project.id))
    .returning()

  return updated
})
