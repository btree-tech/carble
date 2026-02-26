import type { RelationalQueryBuilderConfig } from '@carble/db'
import z from 'zod'

export default async function(
  withInput: RelationalQueryBuilderConfig<'projects', 'findFirst'>['with'] = {},
  extras: RelationalQueryBuilderConfig<'projects', 'findFirst'>['extras'] = {},
) {
  const { projectId } = await getValidatedRouterParams(
    useEvent(),
    z.object({
      projectId: z.coerce.number(),
    }).parse,
  )

  const project = await useDatabase().query.projects.findFirst({
    with: withInput,
    where: ({ id }, { eq }) => eq(id, projectId),
    extras,
  })

  if (!project) throw createError({ statusCode: 404 })

  return project
}
