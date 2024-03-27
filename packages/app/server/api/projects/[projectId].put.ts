import { connect } from '@carble/db'
import { projects } from '@carble/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const updateProjectSchema = z.object({
  name: z.string(),
})

export default defineEventHandler(async (event) => {
  const project = await findProject()
  const data = await validate(updateProjectSchema, await readBody(event))

  const [updated] = await connect().update(projects)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, project.id))
    .returning()

  return updated
})
