import type { Transaction } from '@carble/db'
import { cards, contents, fields, images, projects } from '@carble/db/schema'
import { createId } from '@paralleldrive/cuid2'
import { createSelectSchema } from 'drizzle-zod'
import { copyFile } from 'node:fs/promises'
import { extname } from 'node:path'
import z from 'zod'

type FromProject  = typeof projects.$inferSelect & {
  fields: (typeof fields.$inferSelect)[]
  cards: typeof cards.$inferSelect & {
    contents: (typeof contents.$inferSelect)[]
    images: (typeof images.$inferSelect)[]
  }[]
}

export default defineEventHandler(async (event) => {
  const data = await readValidatedBody(
    event,
    z.object({
      id: z.array(createSelectSchema(cards).shape.id).nonempty(),
      to: createSelectSchema(projects).shape.id.optional(),
    }).parse,
  )

  const fromProject = await findProject({
    fields: true,
    cards: {
      where: ({ id }, { inArray }) => inArray(id, data.id),
      orderBy: ({ order, id }, { asc }) => [asc(order), asc(id)],
      with: {
        contents: true,
        images: true,
      },
    },
  }) as unknown as FromProject

  return await useDatabase().transaction(async (tx) => {
    const {
      project: toProject,
      maxFieldOrder,
      maxCardId,
      maxCardOrder,
    } = await findOrCreateProject(tx, data.to)

    const insertFieldValues = fromProject.fields
      .filter(({ name }) => !(toProject.fields ?? []).find((f) => f.name === name))
      .map(({ name }, i) => ({
        projectId: toProject.id,
        order: maxFieldOrder + 1 + i,
        name,
      } satisfies typeof fields.$inferInsert))
    const newFields = insertFieldValues.length
      ? await tx.insert(fields)
          .values(insertFieldValues)
          .returning()
      : []
    const fieldsMap = new Map(
      [...toProject.fields, ...newFields].map(({ id, name }) => [name ?? '', id])
    )

    const insertCardValues = fromProject.cards.map((_, i) => ({
      projectId: toProject.id,
      id: (maxCardId ?? 0) + 1 + i,
      order: (maxCardOrder ?? 0) + 1 + i,
    } satisfies typeof cards.$inferInsert))

    await tx.insert(cards).values(insertCardValues)

    const insertContentValues = fromProject.cards.flatMap(({ contents: fromContents }, i) => {
      return fromContents.map(({ fieldId, body }) => {
        const fieldName = fromProject.fields.find(({ id }) => fieldId === id)?.name ?? ''
        return {
          projectId: toProject.id,
          cardId: (maxCardId ?? 0) + 1 + i,
          fieldId: fieldsMap.get(fieldName)!,
          body,
        } satisfies typeof contents.$inferInsert
      })
    })

    if (insertContentValues.length) {
      await tx.insert(contents).values(insertContentValues)
    }

    const imagesMap = new Map(
      fromProject.cards.flatMap(({ images }) => {
        return images.map(({ filename }) => [
          filename,
          `${createId()}.${extname(filename)}`
        ])
      })
    )
    const insertImageValues = fromProject.cards.flatMap(({ images: fromImages }, i) => {
      return fromImages.map(({ filename }) => ({
        projectId: toProject.id,
        cardId: (maxCardId ?? 0) + 1 + i,
        filename: imagesMap.get(filename)!,
      } satisfies typeof images.$inferInsert))
    })

    if (insertImageValues.length) {
      await tx.insert(images).values(insertImageValues)

      await Promise.all(imagesMap.entries().map((([from, to]) => {
        return copyFile(
          resolveStoragePath('uploads', 'public/images', from),
          resolveStoragePath('uploads', 'public/images', to),
        )
      })))
    }

    await touchProjectUpdatedAt(tx, toProject.id)

    return {
      id: toProject.id,
    }
  })
})

async function findOrCreateProject(tx: Transaction, projectId?: number) {
  if (projectId) {
    const project = await tx.query.projects.findFirst({
      where: ({ id }, { eq }) => eq(id, projectId),
      with: {
        fields: true,
        cards: {
          columns: {
            id: true,
            order: true,
          },
        },
      },
    })
    if (!project) throw createValidationError()
    return {
      project,
      maxFieldOrder: Math.max(0, ...project.fields.map(({ order }) => order)),
      maxCardId: Math.max(0, ...project.cards.map(({ id }) => id)),
      maxCardOrder: Math.max(0, ...project.cards.map(({ order }) => order)),
    }
  } else {
    const [project] = await tx.insert(projects).values({ name: '無題のプロジェクト' }).returning()
    return {
      project: {
        ...project,
        fields: [],
        cards: [],
      },
      maxFieldOrder: 0,
      maxCardId: 0,
      maxCardOrder: 0,
    }
  }
}
