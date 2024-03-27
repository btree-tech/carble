import { connect } from '@carble/db'
import { cards, images } from '@carble/db/schema'
import { createId } from '@paralleldrive/cuid2'
import { eq, max } from 'drizzle-orm'
import { extension } from 'mime-types'

export default defineEventHandler(async (event) => {
  const project = await findProject()

  const body = await readMultipartFormData(event)
  const file = body?.find((data) => data.name === 'image')

  return connect().transaction(async (tx) => {
    const [result] = await tx
      .select({ max: max(cards.number) })
      .from(cards)
      .where(eq(cards.projectId, project.id))

    const [card] = await tx.insert(cards)
      .values({
        projectId: project.id,
        number: (result.max || 0) + 1,
      })
      .returning()

    if (file) {
      const filename = `${createId()}.${extension(file.type!)}`

      await tx.insert(images).values({
        projectId: project.id,
        cardId: card.id,
        filename,
      })

      await useStorage('uploads/public/images').setItemRaw(filename, file.data)
    }

    return card
  })
})
