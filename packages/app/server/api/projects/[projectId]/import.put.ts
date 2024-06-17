import { cards, contents, fields, images } from '@carble/db/schema'
import { createId } from '@paralleldrive/cuid2'
import busboy from 'busboy'
import { and, eq, inArray, max, sql } from 'drizzle-orm'
import { type SQLiteInsertValue } from 'drizzle-orm/sqlite-core'
import { AsyncUnzipInflate, Unzip } from 'fflate/node'
import { fileTypeStream } from 'file-type/core'
import * as fs from 'node:fs'
import { createWriteStream, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { extname, resolve as pathResolve } from 'node:path'
import { Readable } from 'node:stream'
import * as XLSX from 'xlsx'

XLSX.set_fs(fs)

const IdFieldName = 'ID' as const
const ImageFieldName = '画像ファイル' as const

async function getRequestFileStream() {
  const { req } = useEvent().node
  const bb = busboy({
    headers: req.headers,
    limits: {
      files: 1,
    },
  })

  return new Promise<Readable>((resolve, reject) => {
    bb.on('file', async (name, file, info) => {
      resolve(file)
    })
    bb.on('error', reject)

    req.pipe(bb)
  })
}

async function streamToBuffer(stream: Readable) {
  const chunks: Buffer[] = []
  return new Promise<Buffer>((resolve, reject) => {
    stream
      .on('data', (chunk) => {
        chunks.push(Buffer.from(chunk))
      })
      .on('error', reject)
      .on('close', () => {
        resolve(Buffer.concat(chunks))
      })
  })
}

async function unzip(stream: Readable, to: string) {
  return new Promise<{ files: string[] }>((resolve, reject) => {
    const files: string[] = []
    let writedCount = 0

    const unzipper = new Unzip((file) => {
      if (file.name.match('__MACOSX')) {
        file.terminate()
        return
      }

      const toPath = pathResolve(to, file.name)
      files.push(toPath)
      mkdirSync(pathResolve(toPath, '../'), { recursive: true })

      const writeStream = createWriteStream(toPath)
      writeStream.on('close', () => {
        writedCount++
        if (writedCount >= files.length) {
          resolve({ files })
        }
      })

      file.ondata = (err, data, final) => {
        if (err) {
          return reject(err)
        }
        if (final) {
          writeStream.end(data)
        } else {
          writeStream.write(data)
        }
      }
      file.start()
    })
    unzipper.register(AsyncUnzipInflate)

    stream
      .on('data', (chunk) => {
        unzipper.push(Buffer.from(chunk))
      })
      .on('error', reject)
  })
}

async function toWorkbook() {
  const fileStream = await getRequestFileStream()
  const streamWithFileType = await fileTypeStream(fileStream)
  const isZip = streamWithFileType.fileType?.ext === 'zip'
  if (isZip) {
    const baseDir = resolveStoragePath('uploads', 'imports', createId())
    const { files } = await unzip(streamWithFileType, baseDir)
      .catch((err) => {
        console.error(err)
        return Promise.reject('zipファイルの解凍に失敗しました')
      })

    const xlsxFiles = files.filter((file) => file.endsWith('.xlsx') || file.endsWith('.csv'))
    if (xlsxFiles.length < 1) return Promise.reject('zip内にエクセル/CSVファイルが含まれていません')
    if (xlsxFiles.length > 1) return Promise.reject('zip内にエクセル/CSVファイルが複数含まれています')

    return {
      isZip,
      wb: XLSX.readFile(xlsxFiles[0]),
      baseDir,
      cwd: pathResolve(xlsxFiles[0], '../'),
    }
  } else {
    const data = await streamToBuffer(streamWithFileType)
    return {
      isZip,
      wb: XLSX.read(data, { type: 'buffer' }),
    }
  }
}

function cleanup(dirPath?: string) {
  if (dirPath && existsSync(dirPath)) {
    rmSync(dirPath, { recursive: true, force: true })
  }
}

function createValidationError(errors: string[], dirPath?: string) {
  cleanup(dirPath)

  return createError({
    status: 422,
    message: JSON.stringify(errors),
  })
}

export default defineEventHandler(async () => {
  await findProject()

  const {
    isZip,
    baseDir,
    cwd,
    wb,
  } = await toWorkbook()
    .catch((err: string) => {
      throw createValidationError([err])
    })

  const sheet = wb.Sheets[wb.SheetNames[0]]
  const json = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })
  if (json.length < 1) throw createValidationError(['エクセル/CSVファイルに行が存在していません'], baseDir)

  const fieldNames = json[0].filter((f) => f !== IdFieldName && f !== ImageFieldName)
  const importData = json.slice(1)

  const idIndex = fieldNames.findIndex((value) => value === IdFieldName)
  const imageIndex = fieldNames.findIndex((value) => value === ImageFieldName)
  const hasImageField = isZip && imageIndex >= 0

  // validation
  const errors: string[] = []
  importData.forEach((raw, i) => {
    if (raw[idIndex] && !/^[0-9]+$/.test(raw[idIndex])) {
      errors.push(`${i + 1}行目: IDは数字で入力してください`)
    }

    if (hasImageField && raw[imageIndex]) {
      raw[imageIndex].split(/\s/).forEach((p) => {
        const imagePath = pathResolve(cwd, p)
        if (!existsSync(imagePath)) {
          errors.push(`${i + 1}行目: 画像ファイル(${p})が存在していません`)
        }
      })
    }
  })
  if (errors.length) throw createValidationError(errors, baseDir)

  // save
  await useDatabase().transaction(async (tx) => {
    const project = await findProject({
      fields: true,
    })
    const [{ value: currentMaxCardId }] = await tx
      .select({
         value: max(cards.id),
       })
      .from(cards)
      .where(eq(cards.projectId, project.id))

    let maxOrder = Math.max(0, ...project.fields.map((f) => f.order))
    const insertFieldValues = fieldNames
      .filter((name) => project.fields.every((f) => f.name !== name))
      .map((name) => ({
        name,
        projectId: project.id,
        order: ++maxOrder,
      }))
    if (insertFieldValues.length) {
      project.fields = [
        ...project.fields,
        ...await tx.insert(fields)
          .values(insertFieldValues)
          .returning(),
      ]
    }

    let maxCardId = Math.max(0, Number(currentMaxCardId), ...importData.map((raw) => Number(raw[idIndex] || 0)))
    const insertCardValues: SQLiteInsertValue<typeof cards>[] = []
    const insertContentValues: SQLiteInsertValue<typeof contents>[] = []
    const insertImageValues: SQLiteInsertValue<typeof images>[] = []
    const imagePaths: { from: string, to: string }[] = []
    importData.forEach((raw) => {
      const cardId = raw[idIndex] ? Number(raw[idIndex]) : ++maxCardId

      insertCardValues.push({
        id: cardId,
        projectId: project.id,
      })

      fieldNames.forEach((fieldName, i) => {
        project.fields
          .filter((field) => field.name === fieldName)
          .forEach((field) => {
            insertContentValues.push({
              projectId: project.id,
              cardId,
              fieldId: field.id,
              body: raw[i],
            })
          })
      })

      if (hasImageField && raw[imageIndex]) {
        raw[imageIndex].split(/\s/).forEach((image) => {
          const path = pathResolve(cwd, image)
          const filename = `${createId()}.${extname(path)}`
          insertImageValues.push({
            projectId: project.id,
            cardId,
            filename,
          })
          imagePaths.push({
            from: path,
            to: filename,
          })
        })
      }
    })

    await tx.insert(cards)
      .values(insertCardValues)
      .onConflictDoNothing({ target: [cards.projectId, cards.id] })

    await tx.insert(contents)
      .values(insertContentValues)
      .onConflictDoUpdate({
        target: [contents.projectId, contents.cardId, contents.fieldId],
        set: {
          body: sql`excluded.body`,
          updatedAt: new Date(),
        },
      })

    // 「画像ファイル列」が存在する場合のみ画像データを置き換え
    if (hasImageField) {
      const deleteImages = await tx.delete(images)
        .where(and(
          eq(images.projectId, project.id),
          inArray(images.cardId, insertCardValues.map((card) => card.id as number)),
        ))
        .returning()

      await tx.insert(images)
        .values(insertImageValues)
        .returning()

      imagePaths.forEach((path) => {
        renameSync(path.from, resolveStoragePath('uploads', 'public/images', path.to))
      })

      await Promise.all(
        deleteImages.map((image) => useStorage('uploads/public/images').removeItem(image.filename))
      )
    }

    await touchProjectUpdatedAt()
  })

  cleanup(baseDir)
})
