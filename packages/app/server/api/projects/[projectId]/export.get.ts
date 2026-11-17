import { AsyncZipDeflate, Zip } from 'fflate/node'
import { createReadStream, existsSync } from 'node:fs'
import { extname } from 'node:path'
import { ReadableStream } from 'node:stream/web'
import * as XLSX from 'xlsx'

const IdFieldName = 'ID' as const
const ImageFieldName = '画像ファイル' as const

defineRouteMeta({
  openAPI: {
    tags: ['projects'],
    summary: 'エクスポート',
    // 入力: [場所, 名前, 型, 必須, 内容]
    'x-input': [
      ['パス', 'projectId', '整数', '必須', 'プロジェクトの ID'],
    ],
    // 処理: [条件, 処理]
    'x-process': [
      ['（常に）', '項目とカードをエクセルのファイルにし、画像のファイルとともに zip にする（中身はインポート・エクスポートの仕様）'],
    ],
    // 出力: [状態, 条件, 本文]
    'x-output': [
      ['200', '（常に）', 'zip のファイル'],
    ],
    // エラー: [状態, 条件]（ログイン・メンバー・ロールによるものは docs/product-spec/features/roles.md）
    'x-errors': [
      ['409', 'プロジェクトに取り込み待ち・取り込み中のインポートがある'],
    ],
    // 実装との乖離
    'x-implementation-gap': [
      ['エクスポートは、サーバーがエラー（500）を返して失敗する（[ISSUES.md](../../ISSUES.md#エクスポートが失敗する)）'],
    ],
  },
})

export default defineEventHandler(async () => {
  const project = await findProject({
    fields: {
      orderBy: ({ order }, { asc }) => asc(order),
    },
  })

  const cards = await useDatabase().query.cards.findMany({
    where: ({ projectId }, { eq }) => eq(projectId, project.id),
    orderBy: ({ order, id }, { asc }) => [asc(order), asc(id)],
    with: {
      contents: true,
      images: {
        orderBy: ({ createdAt }, { asc }) => asc(createdAt),
      },
    },
  })

  const data = [
    [IdFieldName, ...project.fields.map((field) => field.name), ImageFieldName],
    ...cards.map((card) => [
      card.id,
      ...project.fields.map((field) => card.contents.find((content) => content.fieldId === field.id)?.body),
      card.images.map((image) => `${card.id}-${image.id}${extname(image.filename)}`).join('\n'),
    ]),
  ]
  const wb = XLSX.utils.book_new(XLSX.utils.aoa_to_sheet(data))

  const stream = new ReadableStream({
    start: async (controller) => {
      const zip = new Zip((err, data, final) => {
        if (err) return controller.error(err)

        controller.enqueue(data)
        if (final) {
          controller.close()
        }
      })

      const xlsxFile = new AsyncZipDeflate(`${(project.name ?? '').replace(/[\\/:*?"<>|]/, '_')}.xlsx`)
      zip.add(xlsxFile)
      xlsxFile.push(XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }), true)

      for await (const card of cards) {
        for await (const image of card.images) {
          await new Promise<void>((resolve) => {
            const path = resolveStoragePath('uploads', 'public/images', image.filename)
            if (!existsSync(path)) return Promise.resolve()

            const file = new AsyncZipDeflate(`${card.id}-${image.id}${extname(image.filename)}`)
            zip.add(file)

            createReadStream(path)
              .on('data', (chunk) => {
                file.push(Uint8Array.from(typeof chunk === 'object' ? chunk : Buffer.from(chunk)))
              })
              .on('close', () => {
                file.push(new Uint8Array(), true)
                resolve()
              })
          })
        }
      }

      zip.end()
    }
  })

  return stream
})
