import type { RelationalQueryBuilderConfig } from '@carble/db'

export default async function(
  withInput: RelationalQueryBuilderConfig<'projects', 'findFirst'>['with'] = {},
  extras: RelationalQueryBuilderConfig<'projects', 'findFirst'>['extras'] = {},
) {
  const projectId = getRouterParam(useEvent(), 'projectId')

  const project = await useDatabase().query.projects.findFirst({
    with: withInput,
    where: ({ id }, { eq }) => eq(id, Number(projectId)),
    extras,
  })

  if (!project) throw createError({ statusCode: 404 })

  return project
}
