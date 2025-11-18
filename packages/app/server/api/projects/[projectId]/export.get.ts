import { AsyncZipDeflate, Zip } from 'fflate/node'
import { createReadStream, existsSync } from 'node:fs'
import { extname } from 'node:path'
import { ReadableStream } from 'node:stream/web'
import * as XLSX from 'xlsx'

const IdFieldName = 'ID' as const
const ImageFieldName = '画像ファイル' as const

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

      const xlsxFile = new AsyncZipDeflate(`${project.name}.xlsx`)
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
