import { connect } from '@carble/db'

export default async function() {
  const projectId = getRouterParam(useEvent(), 'projectId')
  const fieldId = getRouterParam(useEvent(), 'fieldId')

  const field = await connect().query.fields.findFirst({
    where: (t, { eq, and }) => and(
      eq(t.id, Number(fieldId)),
      eq(t.projectId, Number(projectId)),
    ),
  })

  if (!field) throw createError({ statusCode: 404 })

  return field
}
