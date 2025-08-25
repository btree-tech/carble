import type { RelationalQueryBuilderConfig } from '@carble/db'
import z from 'zod'

export default async function(withInput: RelationalQueryBuilderConfig<'cards', 'findFirst'>['with'] = {}) {
  const {
    projectId,
    cardId,
  } = await getValidatedRouterParams(
    useEvent(),
    z.object({
      projectId: z.coerce.number(),
      cardId: z.coerce.number(),
    }).parse,
  )

  const card = await useDatabase().query.cards.findFirst({
    where: (t, { eq, and }) => and(
      eq(t.id, cardId),
      eq(t.projectId, projectId),
    ),
    with: withInput,
  })

  if (!card) throw createError({ statusCode: 404 })

  return card
}
