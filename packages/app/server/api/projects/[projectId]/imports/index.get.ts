import { imports } from '@carble/db/schema'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'

defineRouteMeta({
  openAPI: {
    tags: ['imports'],
    summary: 'インポートの一覧',
    // 入力: [場所, 名前, 型, 必須, 内容]
    'x-input': [
      ['パス', 'projectId', '整数', '必須', 'プロジェクトの ID'],
      ['クエリ', 'status', 'OPEN・IN_PROGRESS・DONE・ABORT・FORMAT_ERROR・SYSTEM_ERROR から 2 つ以上', '任意', 'そのどれかの状態のインポートに絞り込む'],
      ['クエリ', 'unnotified', '真偽値', '任意', 'true なら結果を知らせていないインポートに絞り込む'],
      ['クエリ', 'page', '整数', '任意', 'ページ（既定は 1）'],
      ['クエリ', 'pageCount', '整数', '任意', '1 ページの件数（既定は 10）'],
    ],
    // 処理: [条件, 処理]
    'x-process': [
      ['（常に）', 'プロジェクトのインポートを取得する'],
      ['status がある', 'そのどれかの状態のインポートだけにする'],
      ['unnotified が true', '結果を知らせていないインポートだけにする'],
      ['（常に）', '登録の新しい順に並べ、page のページの pageCount 件を取る'],
    ],
    // 出力: [状態, 条件, 本文]
    'x-output': [
      ['200', '（常に）', 'インポートの配列（items）、絞り込んだインポートの総数（total）、1 ページの件数（pageCount）'],
    ],
    // エラー: [状態, 条件]（ログイン・メンバー・ロールによるものは docs/product-spec/features/roles.md）
    'x-errors': [
      ['400', 'クエリが入力の形に合わない'],
    ],
  },
})

export default defineEventHandler(async (event) => {
  const project = await findProject()
  const data = await getValidatedQuery(
    event,
    z.object({
      status: z.array(createSelectSchema(imports).shape.status).optional(),
      unnotified: z.coerce.boolean().optional(),
      page: z.coerce.number().default(1),
      pageCount: z.coerce.number().default(10),
    }).parse,
  )

  const where = and(
    eq(imports.projectId, project.id),
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

    const total = await tx.$count(imports, where)

    return {
      items: items,
      total,
      pageCount: data.pageCount,
    }
  })
})
