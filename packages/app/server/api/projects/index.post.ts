import { fields, projects, usersToProjects } from '@carble/db/schema'
import z from 'zod'

defineRouteMeta({
  openAPI: {
    tags: ['projects'],
    summary: 'プロジェクトの作成',
    // 入力: [場所, 名前, 型, 必須, 内容]
    'x-input': [
      ['本文（JSON）', 'name', '文字列', '任意', 'プロジェクトの名前'],
      ['本文（JSON）', 'fields', '真偽値', '任意', 'true なら初期の項目を作る'],
    ],
    // 処理: [条件, 処理]
    'x-process': [
      ['（常に）', 'プロジェクトを作り、自分をオーナーにする'],
      ['name がある', '名前を name にする'],
      ['name が無い', '名前を「無題のプロジェクト」にする'],
      ['fields が true', '項目「みだし」「メモ」をこの順に作る'],
      ['fields が無い', '項目を作らない'],
    ],
    // 出力: [状態, 条件, 本文]
    'x-output': [
      ['200', '（常に）', '作ったプロジェクト'],
    ],
    // エラー: [状態, 条件]（ログイン・メンバー・ロールによるものは docs/product-spec/features/roles.md）
    'x-errors': [
      ['400', '本文が入力の形に合わない'],
    ],
  },
})

export default defineEventHandler(async (event) => {
  const user = await useSessionUser()

  const data = await readValidatedBody(
    event,
    z.object({
      name: z.string().optional(),
      fields: z.boolean().optional(),
    }).optional().parse,
  )

  return await useDatabase().transaction(async (tx) => {
    const [project] = await tx.insert(projects)
      .values({
        name: data?.name ?? '無題のプロジェクト',
      })
      .returning()

    await tx.insert(usersToProjects)
      .values({
        userId: user.id,
        projectId: project.id,
        role: 'owner',
      })

    if (data?.fields) {
      await tx.insert(fields)
        .values([
          {
            projectId: project.id,
            name: 'みだし',
            order: 1,
          },
          {
            projectId: project.id,
            name: 'メモ',
            order: 2,
          },
        ])
    }

    return project
  })
})
