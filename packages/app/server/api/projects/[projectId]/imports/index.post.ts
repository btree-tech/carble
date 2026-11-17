import { imports } from '@carble/db/schema'
import busboy from 'busboy'
import type { WriteStream } from 'node:fs'
import { createWriteStream } from 'node:fs'
import { z } from 'zod'

const createImportSchema = z.object({
  originalFilename: z.string(),
  mimeType: z.union([
    z.literal('application/zip'),
    z.literal('application/x-zip-compressed'),
    z.literal('text/csv'),
    z.literal('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
  ]),
  options: z.object({
    update: z.boolean(),
  }),
})

async function getRequestFileStream(writeStream: WriteStream) {
  const { req } = useEvent().node
  const bb = busboy({
    headers: req.headers,
    defParamCharset: 'utf8',
    limits: {
      files: 1,
    },
  })

  return new Promise((resolve, reject) => {
    const result = {
      mimeType: '',
      originalFilename: '',
      options: {
        update: false,
      },
    }
    bb
      .on('field', (name, value) => {
        if (name === 'update') {
          result.options.update = value === 'true'
        }
      })
      .on('file', async (name, file, info) => {
        if (name === 'file') {
          result.mimeType = info.mimeType
          result.originalFilename = info.filename
          file.pipe(writeStream)
        }
      })
      .on('error', reject)
      .on('close', () => {
        resolve(result)
      })

    req.pipe(bb)
  })
}

defineRouteMeta({
  openAPI: {
    tags: ['imports'],
    summary: 'インポートの登録',
    // 入力: [場所, 名前, 型, 必須, 内容]
    'x-input': [
      ['パス', 'projectId', '整数', '必須', 'プロジェクトの ID'],
      ['本文（multipart）', 'file', 'zip・CSV・エクセルのファイル', '必須', 'インポートするファイル'],
      ['本文（multipart）', 'update', 'true・false', '任意', 'true なら同じ ID のカードを上書きする'],
    ],
    // 処理: [条件, 処理]
    'x-process': [
      ['（常に）', 'ファイルを保存し、インポートを取り込み待ち（OPEN）として登録する（取り込みはインポート・エクスポートの仕様）'],
      ['update が true', '同じ ID のカードを上書きするインポートにする'],
    ],
    // 出力: [状態, 条件, 本文]
    'x-output': [
      ['200', '（常に）', '登録したインポート'],
    ],
    // エラー: [状態, 条件]（ログイン・メンバー・ロールによるものは docs/product-spec/features/roles.md）
    'x-errors': [
      ['422', 'file が無いか、zip・CSV・エクセルのファイルでない'],
    ],
  },
})

export default defineEventHandler(async () => {
  const sessionUser = await useSessionUser()
  const project = await findProject({
    users: {
      where: ({ userId, role }, { and, eq }) => and(
        eq(userId, sessionUser.id),
        eq(role, 'owner'),
      ),
      limit: 1,
    },
  })

  const {
    name: filename,
    path,
  } = getUniqueFile(resolveStoragePath('uploads', 'imports'))

  const stream = createWriteStream(path)

  const {
    originalFilename,
    options,
  } = await validate(createImportSchema, await getRequestFileStream(stream))

  return await useDatabase().transaction(async (tx) => {
    const [importData] = await tx.insert(imports)
      .values({
        projectId: project.id,
        filename,
        originalFilename,
        status: 'OPEN',
        options,
      })
      .returning()

    return new Promise<typeof imports.$inferSelect>((resolve) => {
      stream.on('close', () => {
        resolve(importData)
      })
    })
  })
})
