import { cards, contents, images } from '@carble/db/schema'
import { createId } from '@paralleldrive/cuid2'
import { eq, max } from 'drizzle-orm'
import type { SQLiteInsertValue } from 'drizzle-orm/sqlite-core'
import { copyFile } from 'node:fs/promises'
import { extname } from 'node:path'

export default defineEventHandler(async () => {
  const card = await findCard({
    contents: true,
    images: true,
  })

  return await useDatabase().transaction(async (tx) => {
    const [result] = await tx
      .select({ max: max(cards.id) })
      .from(cards)
      .where(eq(cards.projectId, card.projectId))

    const [newCard] = await tx.insert(cards)
      .values({
        projectId: card.projectId,
        id: (result.max || 0) + 1,
      })
      .returning()

    if (card.contents.length) {
      await tx.insert(contents)
        .values(card.contents.map((content) => ({
          ...content,
          cardId: newCard.id,
        })))
    }

    if (card.images.length) {
      const insertImageValues: SQLiteInsertValue<typeof images>[] = []
      const imagePaths: { from: string, to: string }[] = []
      card.images.forEach((image) => {
        const filename = `${createId()}.${extname(image.filename)}`
        insertImageValues.push({
          projectId: image.projectId,
          cardId: newCard.id,
          filename,
        })
        imagePaths.push({
          from: image.filename,
          to: filename,
        })
      })
      await tx.insert(images)
        .values(insertImageValues)

      await Promise.all(imagePaths.map((path) => {
        const from = resolveStoragePath('uploads', 'public/images', path.from)
        const to = resolveStoragePath('uploads', 'public/images', path.to)
        return copyFile(from, to)
      }))
    }

    await touchProjectUpdatedAt()

    return await tx.query.cards.findFirst({
      where: (t, { eq, and }) => and(
        eq(t.id, newCard.id),
        eq(t.projectId, newCard.projectId),
      ),
      with: {
        contents: true,
        images: {
          orderBy: ({ createdAt }, { asc }) => asc(createdAt),
        },
      },
    })
  })
})
