import type { RelationalQueryBuilderConfig } from '@carble/db'
import { z } from 'zod'

const schema = z.object({
  projectId: z.coerce.number().gt(0),
  importId: z.coerce.number().gt(0),
})

export default async function(
  withInput: RelationalQueryBuilderConfig<'imports', 'findFirst'>['with'] = {},
  extras: RelationalQueryBuilderConfig<'imports', 'findFirst'>['extras'] = {},
) {
  const {
    projectId,
    importId,
  } = await getValidatedRouterParams(useEvent(), schema.parse)

  const importData = await useDatabase().query.imports.findFirst({
    with: withInput,
    where: (t, { eq, and }) => and(
      eq(t.projectId, projectId),
      eq(t.id, importId),
    ),
    extras,
  })

  if (!importData) throw createError({ statusCode: 404 })

  return importData
}
