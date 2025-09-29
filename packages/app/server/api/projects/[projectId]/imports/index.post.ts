import { imports } from '@carble/db/schema'
import busboy from 'busboy'
import { createWriteStream } from 'node:fs'
import { Readable } from 'node:stream'
import { z } from 'zod'

const createImportSchema = z.object({
  name: z.literal('file'),
  originalFilename: z.string(),
  stream: z.instanceof(Readable),
})

async function getRequestFileStream() {
  const { req } = useEvent().node
  const bb = busboy({
    headers: req.headers,
    defParamCharset: 'utf8',
    limits: {
      files: 1,
    },
  })

  return new Promise<{ name: string, originalFilename: string, stream: Readable }>((resolve, reject) => {
    bb
      .on('file', async (name, file, info) => {
        resolve({
          name,
          originalFilename: info.filename,
          stream: file,
        })
      })
      .on('error', reject)

    req.pipe(bb)
  })
}

export default defineEventHandler(async () => {
  const project = await findProject()

  const {
    stream,
    originalFilename,
  } = await validate(createImportSchema, await getRequestFileStream())

  const {
    name: filename,
    path,
  } = getUniqueFile(resolveStoragePath('uploads', 'imports'))

  return await useDatabase().transaction(async (tx) => {
    const [importData] = await tx.insert(imports)
      .values({
        projectId: project.id,
        filename,
        originalFilename,
        status: 'OPEN',
      })
      .returning()

    return new Promise<typeof imports.$inferSelect>((resolve) => {
      stream.pipe(
        createWriteStream(path)
          .on('close', () => {
            resolve(importData)
          })
      )
    })
  })
})
