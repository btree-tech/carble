import { cards, contents } from '@carble/db/schema'
import { and, asc, desc, eq, getTableColumns, isNull, like } from 'drizzle-orm'
import { z } from 'zod'

defineRouteMeta({
  openAPI: {
    tags: ['cards'],
    summary: 'カードの一覧',
    // 入力: [場所, 名前, 型, 必須, 内容]
    'x-input': [
      ['パス', 'projectId', '整数', '必須', 'プロジェクトの ID'],
      ['クエリ', 'q', '文字列', '任意', '値で絞り込む文字列'],
      ['クエリ', 'sort', 'id・order・項目の ID', '任意', '並べる基準（既定は id）'],
      ['クエリ', 'direction', 'asc・desc', '任意', '並べる向き（既定は asc）'],
    ],
    // 処理: [条件, 処理]
    'x-process': [
      ['（常に）', 'プロジェクトのカードを取得する'],
      ['q がある', '値に q を含むカードだけにする'],
      ['sort が無いか id', 'ID の順に並べる'],
      ['sort が order', '並び順の順に並べ、並び順が同じなら ID の順にする'],
      ['sort が項目の ID', 'その項目の値の順に並べ、値が同じなら ID の順にする'],
      ['direction が無いか asc', '昇順に並べる'],
      ['direction が desc', '降順に並べる'],
    ],
    // 出力: [状態, 条件, 本文]
    'x-output': [
      ['200', '（常に）', 'カードの配列（items）と、プロジェクトのカードの総数（total。q で絞り込む前の数）。各カードに、値（contents）・画像（images。追加した順）・複製元のカード（original）・複製先のカード（duplicates。複製先のプロジェクトの名前つき）を付ける'],
    ],
    // エラー: [状態, 条件]（ログイン・メンバー・ロールによるものは docs/product-spec/features/roles.md）
    'x-errors': [
      ['400', 'sort・direction が入力の形に合わない'],
      ['409', 'プロジェクトに取り込み待ち・取り込み中のインポートがある'],
    ],
  },
})

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

  return useDatabase().transaction(async (tx) => {
    const matches = !data.q?.length
      ? undefined
      : tx.$with('matches').as(
          tx.selectDistinct({ cardId: contents.cardId })
            .from(contents)
            .where(and(
              eq(contents.projectId, project.id),
              data.q?.length ? like(contents.body, `%${data.q}%`) : undefined,
            ))
        )
    const weight = typeof data.sort === 'string'
      ? undefined
      : tx.$with('weight').as(
          tx.select({ cardId: contents.cardId, body: contents.body })
            .from(contents)
            .where(and(
              eq(contents.projectId, project.id),
              data.sort !== 0 ? eq(contents.fieldId, data.sort) : isNull(contents.fieldId),
            ))
        )
    const sortFunc = data.direction === 'asc' ? asc : desc

    const query = tx
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

    const relations = await tx.query.cards.findMany({
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

    const total = await tx.$count(cards, eq(cards.projectId, project.id))

    return {
      items: result.map((r) => ({
        ...r,
        ...relations.find((rel) => rel.id === r.id),
      })),
      total,
    }
  })
})
