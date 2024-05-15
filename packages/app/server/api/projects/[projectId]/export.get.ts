import AdmZip from 'adm-zip'
import { extname } from 'node:path'
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
    orderBy: ({ id }, { asc }) => asc(id),
    with: {
      contents: true,
      images: {
        orderBy: ({ createdAt }, { asc }) => asc(createdAt),
      },
    },
  })

  const zip = new AdmZip()

  const data = [
    [IdFieldName, ...project.fields.map((field) => field.name), ImageFieldName],
    ...cards.map((card) => [
      card.id,
      ...project.fields.map((field) => card.contents.find((content) => content.fieldId === field.id)?.body),
      card.images.map((image) => `${card.id}-${image.id}${extname(image.filename)}`).join('\n'),
    ]),
  ]
  const wb = XLSX.utils.book_new(XLSX.utils.aoa_to_sheet(data))
  zip.addFile(`${project.name}.xlsx`, XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }))

  cards.forEach((card) => {
    card.images.forEach((image) => {
      zip.addLocalFile(
        resolveStoragePath('uploads', 'public/images', image.filename),
        '',
        `${card.id}-${image.id}${extname(image.filename)}`
      )
    })
  })

  return zip.toBuffer()
})
