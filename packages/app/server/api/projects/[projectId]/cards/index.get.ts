import { cards, contents } from '@carble/db/schema'
import { and, asc, desc, eq, getTableColumns, isNull, like } from 'drizzle-orm'
import { z } from 'zod'

const schema = z.object({
  q: z.string().optional(),
  sort: z.coerce.number().default(0),
  direction: z.union([z.literal('asc'), z.literal('desc')]).default('asc'),
})

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'projectId')
  const data = await validate(schema, getQuery(event))

  const db = useDatabase()
  const matches = !data.q?.length
    ? undefined
    : db.$with('matches').as(
        db.selectDistinct({ cardId: contents.cardId })
          .from(contents)
          .where(and(
            eq(contents.projectId, Number(projectId)),
            data.q?.length ? like(contents.body, `%${data.q}%`) : undefined,
          ))
      )
  const weight = data.sort === 0
    ? undefined
    : db.$with('weight').as(
        db.select({ cardId: contents.cardId, body: contents.body })
          .from(contents)
          .where(and(
            eq(contents.projectId, Number(projectId)),
            data.sort !== 0 ? eq(contents.fieldId, data.sort) : isNull(contents.fieldId),
          ))
      )
  const sortFunc = data.direction === 'asc' ? asc : desc

  const query = db
    .with(...[matches, weight].filter((w) => !!w))
    .select(getTableColumns(cards))
    .from(cards)
    .where(eq(cards.projectId, Number(projectId)))
  if (matches) {
    query.innerJoin(matches, eq(cards.id, matches.cardId))
  }
  if (weight) {
    query
      .leftJoin(weight, eq(cards.id, weight.cardId))
      .orderBy(sortFunc(weight.body), sortFunc(cards.id))
  } else {
    query.orderBy(sortFunc(cards.id))
  }

  const result = await query

  const relations = await db.query.cards.findMany({
    columns: { id: true },
    where: (t, { eq, inArray, and }) => and(
      eq(t.projectId, Number(projectId)),
      inArray(t.id, result.map((c) => c.id)),
    ),
    with: {
      contents: true,
      images: {
        orderBy: ({ createdAt }, { asc }) => asc(createdAt),
      },
    }
  })

  return result.map((r) => ({
    ...r,
    ...relations.find((rel) => rel.id === r.id),
  }))
})
