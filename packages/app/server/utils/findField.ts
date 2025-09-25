import z from 'zod'

export default async function() {
  const {
    projectId,
    fieldId,
  } = await getValidatedRouterParams(
    useEvent(),
    z.object({
      projectId: z.coerce.number(),
      fieldId: z.coerce.number(),
    }).parse,
  )

  const field = await useDatabase().query.fields.findFirst({
    where: (t, { eq, and }) => and(
      eq(t.id, fieldId),
      eq(t.projectId, projectId),
    ),
  })

  if (!field) throw createError({ statusCode: 404 })

  return field
}
