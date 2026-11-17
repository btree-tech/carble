import { imports } from '@carble/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const updateImportSchema = z.object({
  notified: z.literal(true),
})

defineRouteMeta({
  openAPI: {
    tags: ['imports'],
    summary: 'インポートの結果を知らせたことの記録',
    // 入力: [場所, 名前, 型, 必須, 内容]
    'x-input': [
      ['パス', 'projectId', '整数', '必須', 'プロジェクトの ID'],
      ['パス', 'importId', '整数', '必須', 'インポートの ID'],
      ['本文（JSON）', 'notified', 'true', '必須', '結果を知らせたこと'],
    ],
    // 処理: [条件, 処理]
    'x-process': [
      ['（常に）', 'インポートに、結果を知らせた日時を記録する'],
    ],
    // 出力: [状態, 条件, 本文]
    'x-output': [
      ['200', '（常に）', '記録したインポート'],
    ],
    // エラー: [状態, 条件]（ログイン・メンバー・ロールによるものは docs/product-spec/features/roles.md）
    'x-errors': [
      ['404', 'importId のインポートがプロジェクトに無い'],
      ['400', '本文が入力の形に合わない'],
    ],
  },
})

export default defineEventHandler(async (event) => {
  const importData = await findImport()
  const data = await readValidatedBody(event, updateImportSchema.parse)

  const [updated] = await useDatabase().update(imports)
    .set({
      notifiedAt: data.notified ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(imports.id, importData.id))
    .returning()

  return updated
})
