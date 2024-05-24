import { cards, contents, fields, images } from '@carble/db/schema'
import { createId } from '@paralleldrive/cuid2'
import AdmZip from 'adm-zip'
import { and, eq, inArray, max, sql } from 'drizzle-orm'
import { type SQLiteInsertValue } from 'drizzle-orm/sqlite-core'
import { fileTypeFromBuffer } from 'file-type'
import * as fs from 'node:fs'
import { existsSync, renameSync, rmSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import * as XLSX from 'xlsx'

XLSX.set_fs(fs)

const IdFieldName = 'ID' as const
const ImageFieldName = '画像ファイル' as const

async function toWorkbook() {
  const body = await readMultipartFormData(useEvent())
  const file = body?.find((data) => data.name === 'file')
  if (!file) return Promise.reject('ファイルを選択してください')

  const isZip = (await fileTypeFromBuffer(file.data))?.ext === 'zip'

  if (!isZip) {
    return {
      isZip,
      wb: XLSX.read(file.data, { type: 'buffer' }),
    }
  }

  const zip = new AdmZip(file.data)
  const xlsxFiles: string[] = []
  zip.forEach(({ entryName }) => {
    if (!entryName.match('__MACOSX') && (entryName.endsWith('.xlsx') || entryName.endsWith('.csv'))) {
      xlsxFiles.push(entryName)
    }
  })
  if (xlsxFiles.length < 1) return Promise.reject('zip内にエクセル/CSVファイルが含まれていません')
  if (xlsxFiles.length > 1) return Promise.reject('zip内にエクセル/CSVファイルが複数含まれています')

  const dirPath = resolveStoragePath('uploads', 'imports', createId())
  zip.extractAllTo(dirPath)

  return {
    isZip,
    dirPath,
    basePath: resolve(`${dirPath}/${xlsxFiles[0]}`, '../'),
    wb: XLSX.readFile(`${dirPath}/${xlsxFiles[0]}`),
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
  const {
    isZip,
    dirPath,
    basePath,
    wb,
  } = await toWorkbook()
    .catch((err: string) => {
      throw createValidationError([err])
    })

  const sheet = wb.Sheets[wb.SheetNames[0]]
  const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet)
  if (json.length < 1) throw createValidationError(['エクセル/CSVファイルに行が存在していません'], dirPath)

  const hasImageField = isZip && (ImageFieldName in json[0])

  // validation
  const errors: string[] = []
  json.forEach((raw, i) => {
    if (raw[IdFieldName] && !/^[0-9]+$/.test(raw[IdFieldName])) {
      errors.push(`${i + 1}行目: IDは数字で入力してください`)
    }

    if (hasImageField) {
      raw[ImageFieldName].split(/\s/).forEach((p) => {
        const imagePath = resolve(basePath, p)
        if (!existsSync(imagePath)) {
          errors.push(`${i + 1}行目: 画像ファイル(${p})が存在していません`)
        }
      })
    }
  })
  if (errors.length) throw createValidationError(errors, dirPath)

  const fieldNames = Object.keys(json[0]).filter((f) => f !== IdFieldName && f !== ImageFieldName)

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

    let maxCardId = Math.max(0, Number(currentMaxCardId), ...json.map((raw) => Number(raw[IdFieldName] || 0)))
    const insertCardValues: SQLiteInsertValue<typeof cards>[] = []
    const insertContentValues: SQLiteInsertValue<typeof contents>[] = []
    const insertImageValues: SQLiteInsertValue<typeof images>[] = []
    const imagePaths: { from: string, to: string }[] = []
    json.forEach((raw) => {
      const cardId = raw[IdFieldName] ? Number(raw[IdFieldName]) : ++maxCardId

      insertCardValues.push({
        id: cardId,
        projectId: project.id,
      })

      fieldNames.forEach((fieldName) => {
        project.fields
          .filter((field) => field.name === fieldName)
          .forEach((field) => {
            insertContentValues.push({
              projectId: project.id,
              cardId,
              fieldId: field.id,
              body: raw[fieldName],
            })
          })
      })

      if (hasImageField) {
        raw[ImageFieldName].split(/\s/).forEach((image) => {
          const path = resolve(basePath, image)
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

  cleanup(dirPath)
})
