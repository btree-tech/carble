import { imports } from '@carble/db/schema'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const project = await findProject()
  const data = await getValidatedQuery(
    event,
    z.object({
      status: z.array(createSelectSchema(imports).shape.status).optional(),
      unnotified: z.coerce.boolean().optional(),
      page: z.coerce.number().default(1),
      pageCount: z.coerce.number().default(10),
    }).parse,
  )

  const where = and(
    eq(imports.projectId, project.id),
    data.status ? inArray(imports.status, data.status) : undefined,
    data.unnotified ? isNull(imports.notifiedAt) : undefined,
  )

  return await useDatabase().transaction(async (tx) => {
    const items = await tx.query.imports.findMany({
      where,
      orderBy: ({ createdAt }, { desc }) => desc(createdAt),
      limit: data.pageCount,
      offset: (data.page - 1) * data.pageCount,
    })

    const total = await tx.$count(imports, where)

    return {
      items: items,
      total,
      pageCount: data.pageCount,
    }
  })
})
