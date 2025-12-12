import { cards, contents } from '@carble/db/schema'
import { and, asc, desc, eq, getTableColumns, isNull, like } from 'drizzle-orm'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const project = await findProject()
  const data = await getValidatedQuery(
    event,
    z.object({
      q: z.string().optional(),
      sort: z.union([z.coerce.number(), z.literal('id'), z.literal('order')]).default('id'),
      direction: z.union([z.literal('asc'), z.literal('desc')]).default('asc'),
    }).parse,
  )

  const db = useDatabase()
  const matches = !data.q?.length
    ? undefined
    : db.$with('matches').as(
        db.selectDistinct({ cardId: contents.cardId })
          .from(contents)
          .where(and(
            eq(contents.projectId, project.id),
            data.q?.length ? like(contents.body, `%${data.q}%`) : undefined,
          ))
      )
  const weight = typeof data.sort === 'string'
    ? undefined
    : db.$with('weight').as(
        db.select({ cardId: contents.cardId, body: contents.body })
          .from(contents)
          .where(and(
            eq(contents.projectId, project.id),
            data.sort !== 0 ? eq(contents.fieldId, data.sort) : isNull(contents.fieldId),
          ))
      )
  const sortFunc = data.direction === 'asc' ? asc : desc

  const query = db
    .with(...[matches, weight].filter((w) => !!w))
    .select(getTableColumns(cards))
    .from(cards)
    .where(eq(cards.projectId, project.id))
  if (matches) {
    query.innerJoin(matches, eq(cards.id, matches.cardId))
  }
  if (weight) {
    query
      .leftJoin(weight, eq(cards.id, weight.cardId))
      .orderBy(sortFunc(weight.body), sortFunc(cards.id))
  } else if (data.sort === 'order') {
    query.orderBy(sortFunc(cards.order), sortFunc(cards.id))
  } else {
    query.orderBy(sortFunc(cards.id))
  }

  const result = await query

  const relations = await db.query.cards.findMany({
    columns: { id: true },
    where: (t, { eq, inArray, and }) => and(
      eq(t.projectId, project.id),
      inArray(t.id, result.map((c) => c.id)),
    ),
    with: {
      contents: true,
      images: {
        orderBy: ({ createdAt }, { asc }) => asc(createdAt),
      },
      original: true,
      duplicates: {
        with: {
          project: {
            columns: { name: true },
          },
        },
      },
    }
  })

  return result.map((r) => ({
    ...r,
    ...relations.find((rel) => rel.id === r.id),
  }))
})
