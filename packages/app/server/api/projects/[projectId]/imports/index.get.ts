import { imports } from '@carble/db/schema'
import { and, count, eq, inArray, isNull } from 'drizzle-orm'
import { createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'

const schema = z.object({
  status: z.array(createSelectSchema(imports).shape.status).optional(),
  unnotified: z.coerce.boolean().optional(),
  page: z.coerce.number().default(1),
  pageCount: z.coerce.number().default(10),
})

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(useEvent(), 'projectId')
  const data = await getValidatedQuery(event, schema.parse)

  const where = and(
    eq(imports.projectId, Number(projectId)),
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

    const [{ total }] = await tx.select({ total: count(imports.id) })
      .from(imports)
      .where(where)

    return {
      items: items,
      total,
      pageCount: data.pageCount,
    }
  })
})
