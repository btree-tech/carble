import type { Database, Transaction } from '@carble/db'
import { projects } from '@carble/db/schema'
import { eq } from 'drizzle-orm'
import z from 'zod'

export default async function(db: Transaction|Database = useDatabase(), projectId?: number) {
  projectId ??= (await getValidatedRouterParams(
    useEvent(),
    z.object({
      projectId: z.coerce.number(),
    }).parse,
  )).projectId

  await db.update(projects)
    .set({
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId))
}
