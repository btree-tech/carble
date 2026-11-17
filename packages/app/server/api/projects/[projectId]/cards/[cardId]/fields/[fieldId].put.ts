import { contents } from '@carble/db/schema'
import { z } from 'zod'

defineRouteMeta({
  openAPI: {
    tags: ['cards'],
    summary: '値の保存',
    // 入力: [場所, 名前, 型, 必須, 内容]
    'x-input': [
      ['パス', 'projectId', '整数', '必須', 'プロジェクトの ID'],
      ['パス', 'cardId', '整数', '必須', 'カードの ID'],
      ['パス', 'fieldId', '整数', '必須', '項目の ID'],
      ['本文（JSON）', 'body', '文字列', '必須', '値'],
    ],
    // 処理: [条件, 処理]
    'x-process': [
      ['値がまだ無い', '値を作る'],
      ['値がある', '値を書き換える'],
      ['（常に）', 'プロジェクトの最終更新日時を更新する'],
    ],
    // 出力: [状態, 条件, 本文]
    'x-output': [
      ['200', '（常に）', '保存した値'],
    ],
    // エラー: [状態, 条件]（ログイン・メンバー・ロールによるものは docs/product-spec/features/roles.md）
    'x-errors': [
      ['400', '本文が入力の形に合わない'],
      ['404', 'cardId のカードがプロジェクトに無い'],
      ['404', 'fieldId の項目がプロジェクトに無い'],
      ['409', 'プロジェクトに取り込み待ち・取り込み中のインポートがある'],
    ],
  },
})

export default defineEventHandler(async (event) => {
  const card = await findCard()
  const field = await findField()
  const data = await readValidatedBody(
    event,
    z.object({
      body: z.string(),
    }).parse,
  )

  return await useDatabase().transaction(async (tx) => {
    const [content] = await tx.insert(contents)
      .values({
        projectId: field.projectId,
        cardId: card.id,
        fieldId: field.id,
        body: data.body,
      })
      .onConflictDoUpdate({
        target: [contents.projectId, contents.cardId, contents.fieldId],
        set: {
          body: data.body,
          updatedAt: new Date(),
        },
      })
      .returning()

    await touchProjectUpdatedAt(tx)

    return content
  })
})
