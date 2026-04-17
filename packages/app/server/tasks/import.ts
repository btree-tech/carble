import type { Database, LibSQLResultSet, Transaction } from '@carble/db'
import { cards, contents, fields, images, imports } from '@carble/db/schema'
import { and, eq, inArray, max, sql } from 'drizzle-orm'
import { getTableConfig, type SQLiteInsertBase, type SQLiteInsertValue, type SQLiteTable } from 'drizzle-orm/sqlite-core'
import { fileTypeFromFile } from 'file-type'
import * as fs from 'node:fs'
import { createReadStream, existsSync } from 'node:fs'
import { copyFile, mkdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, resolve as pathResolve } from 'node:path'
import * as unzipper from 'unzipper'
import * as XLSX from 'xlsx'

XLSX.set_fs(fs)

const IdFieldName = 'ID' as const
const ImageFieldName = '画像ファイル' as const

class FormatError extends Error {}

function getUnzippedDir(target: typeof imports.$inferSelect) {
  return pathResolve(tmpdir(), target.filename)
}

async function unzip(target: typeof imports.$inferSelect) {
  await mkdir(getUnzippedDir(target))
  const directory = await unzipper.Open.custom({
    stream: (offset, length) => {
      return createReadStream(
        resolveStoragePath('uploads', 'imports', target.filename),
        {
          start: offset,
          end: length && offset + length,
        },
      )
    },
    size: async () => {
      const stats = await stat(resolveStoragePath('uploads', 'imports', target.filename))
      return stats.size
    },
  })
  await directory.extract({ path: getUnzippedDir(target) })
  return directory.files.map((file) => pathResolve(getUnzippedDir(target), file.path))
}

async function toWorkbook(target: typeof imports.$inferSelect) {
  const fileType = await fileTypeFromFile(resolveStoragePath('uploads', 'imports', target.filename))
  const isZip = fileType?.ext === 'zip'
  if (isZip) {
    const files = await unzip(target)
      .catch(async (err) => {
        console.error(err)
        throw new FormatError('zipファイルの解凍に失敗しました')
      })

    const xlsxFiles = files.filter((file) => !file.match('__MACOSX') && (file.endsWith('.xlsx') || file.endsWith('.csv')))
    if (xlsxFiles.length < 1) throw new FormatError('zip内にエクセル/CSVファイルが含まれていません')
    if (xlsxFiles.length > 1) throw new FormatError('zip内にエクセル/CSVファイルが複数含まれています')

    return {
      isZip,
      wb: XLSX.readFile(xlsxFiles[0]),
    }
  } else {
    return {
      isZip,
      wb: XLSX.readFile(resolveStoragePath('uploads', 'imports', target.filename)),
    }
  }
}

async function chunkInsert<
  T extends SQLiteTable,
  V extends SQLiteInsertValue<T>,
>(
  table: T,
  values: V[],
  modifier?: (query: SQLiteInsertBase<T, 'async', LibSQLResultSet>) => SQLiteInsertBase<T, 'async', LibSQLResultSet>,
  length = Math.ceil(999 / Object.keys(getTableConfig(table).columns).length),
  db: Transaction|Database = useDatabase(),
) {
  const chunked = Map.groupBy(values, (_, i) => Math.floor(i / length)).values()
  for await (const chunk of chunked) {
    let query = db.insert(table).values(chunk)
    if (modifier) {
      query = modifier(query)
    }
    await query
  }
}

async function cleanup(target: typeof imports.$inferSelect) {
  const unzippedDir = getUnzippedDir(target)
  await Promise.all([
    rm(resolveStoragePath('uploads', 'imports', target.filename)),
    unzippedDir && existsSync(unzippedDir) ? rm(unzippedDir, { recursive: true, force: true }) : undefined,
  ])
}

export default defineTask({
  meta: {
    name: 'import',
  },
  run: async () => {
    const target = await useDatabase().query.imports.findFirst({
      where: ({ status }, { eq }) => eq(status, 'OPEN'),
      with: {
        project: {
          with: {
            fields: true,
          },
        },
      },
    })
    if (!target) return { result: 'nothing to do' }

    await useDatabase()
      .update(imports)
      .set({
        status: 'IN_PROGRESS',
        updatedAt: new Date(),
      })
      .where(eq(imports.id, target.id))
    console.log(`import start: `, { target })

    try {
      const {
        isZip,
        wb,
      } = await toWorkbook(target)

      const sheet = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })
      if (json.length < 1) throw new FormatError('エクセル/CSVファイルに行が存在していません')
      if (json.length < 2) throw new FormatError('エクセル/CSVファイルにデータが存在していません')

      const [header, ...importData] = json
      const fieldNames = header.filter((f) => f !== IdFieldName && f !== ImageFieldName)

      const idIndex = header.findIndex((value) => value === IdFieldName)
      const imageIndex = header.findIndex((value) => value === ImageFieldName)
      const hasImageField = isZip && imageIndex >= 0

      // validation
      const errors: string[] = []
      importData.forEach((raw, i) => {
        if (raw[idIndex] && !/^[0-9]+$/.test(raw[idIndex])) {
          errors.push(`${i + 1}行目: IDは数字で入力してください`)
        }

        if (hasImageField && raw[imageIndex]) {
          raw[imageIndex].split(/\s/).forEach((filename) => {
            const imagePath = pathResolve(getUnzippedDir(target), filename)
            if (!existsSync(imagePath)) {
              errors.push(`${i + 1}行目: 画像ファイル(${filename})が存在していません`)
            }
          })
        }
      })
      if (errors.length) throw new FormatError(errors.join('\n'))

      // save
      const db = useDatabase()
      const project = target.project
      const [{ currentMaxCardId, currentMaxOrder }] = await db
        .select({
          currentMaxCardId: max(cards.id),
          currentMaxOrder: max(cards.order),
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
          ...await db.insert(fields)
            .values(insertFieldValues)
            .returning(),
        ]
      }

      let maxCardId = Math.max(0, Number(currentMaxCardId), ...importData.map((raw) => Number(raw[idIndex] || 0)))
      const insertCardValues: typeof cards.$inferInsert[] = []
      const insertContentValues: typeof contents.$inferInsert[] = []
      const insertImageValues: typeof images.$inferInsert[] = []
      const imagePaths: { from: string, to: string }[] = []
      importData.forEach((raw, i) => {
        const cardId = (target.options.update && raw[idIndex]) ? Number(raw[idIndex]) : ++maxCardId

        insertCardValues.push({
          id: cardId,
          projectId: project.id,
          order: (currentMaxOrder ?? 0) + i + 1,
        })

        header.forEach((fieldName, i) => {
          if (i === idIndex || i === imageIndex) return

          project.fields
            .filter((field) => field.name === fieldName)
            .forEach((field) => {
              insertContentValues.push({
                projectId: project.id,
                cardId,
                fieldId: field.id,
                body: raw[i] || '',
              })
            })
        })

        if (hasImageField && raw[imageIndex]) {
          raw[imageIndex].split(/\s/).forEach((image) => {
            const from = pathResolve(getUnzippedDir(target), image)
            const {
              name: filename,
              path: to,
            } = getUniqueFile(resolveStoragePath('uploads', 'public/images'), `${extname(from)}`)
            insertImageValues.push({
              projectId: project.id,
              cardId,
              filename,
            })
            imagePaths.push({
              from,
              to,
            })
          })
        }
      })

      await chunkInsert(cards, insertCardValues, (query) => {
        return query.onConflictDoNothing({ target: [cards.projectId, cards.id] })
      }, undefined, db)

      await chunkInsert(contents, insertContentValues, (query) => {
        return query.onConflictDoUpdate({
          target: [contents.projectId, contents.cardId, contents.fieldId],
          set: {
            body: sql`excluded.body`,
            updatedAt: new Date(),
          },
        })
      }, undefined, db)

      // 「画像ファイル列」が存在する場合のみ画像データを置き換え
      if (hasImageField) {
        const deleteImages = await db.delete(images)
          .where(and(
            eq(images.projectId, project.id),
            inArray(images.cardId, insertCardValues.map((card) => card.id as number)),
          ))
          .returning()

        if (insertImageValues.length) {
          await db.insert(images)
            .values(insertImageValues)
            .returning()
        }

        await Promise.all(
          imagePaths.map(({ from, to }) => copyFile(from, to))
        )

        await Promise.all(
          deleteImages.map(({ filename }) => useStorage('uploads/public/images').removeItem(filename))
        )
      }

      await touchProjectUpdatedAt(undefined, target.projectId)

      await useDatabase()
        .update(imports)
        .set({
          status: 'DONE',
          updatedAt: new Date(),
        })
        .where(eq(imports.id, target.id))
    } catch (err: unknown) {
      const data: Partial<typeof imports.$inferInsert> = {
        updatedAt: new Date(),
      }
      if (err instanceof FormatError) {
        data.status = 'FORMAT_ERROR'
        data.message = err.message
      } else {
        data.status = 'SYSTEM_ERROR'
        data.message = String(err)
        console.error(err)
      }
      await useDatabase()
        .update(imports)
        .set(data)
        .where(eq(imports.id, target.id))

      await cleanup(target)

      return { result: 'failure' }
    }

    await cleanup(target)

    console.log(`import done: `, { target })

    return { result: 'success' }
  },
})
