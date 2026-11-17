import { projects } from '@carble/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

defineRouteMeta({
  openAPI: {
    tags: ['projects'],
    summary: 'プロジェクトの名前の変更',
    // 入力: [場所, 名前, 型, 必須, 内容]
    'x-input': [
      ['パス', 'projectId', '整数', '必須', 'プロジェクトの ID'],
      ['本文（JSON）', 'name', '文字列', '必須', '新しい名前'],
    ],
    // 処理: [条件, 処理]
    'x-process': [
      ['（常に）', 'プロジェクトの名前を name にする'],
      ['（常に）', 'プロジェクトの最終更新日時を更新する'],
    ],
    // 出力: [状態, 条件, 本文]
    'x-output': [
      ['200', '（常に）', '変えたプロジェクト'],
    ],
    // エラー: [状態, 条件]（ログイン・メンバー・ロールによるものは docs/product-spec/features/roles.md）
    'x-errors': [
      ['400', '本文が入力の形に合わない'],
    ],
  },
})

export default defineEventHandler(async (event) => {
  const project = await findProject()
  const data = await readValidatedBody(
    event,
    z.object({
      name: z.string(),
    }).parse,
  )

  const [updated] = await useDatabase().update(projects)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, project.id))
    .returning()

  return updated
})
