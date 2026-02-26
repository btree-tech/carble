import { createReadStream, existsSync } from 'node:fs'
import { basename } from 'node:path'
import sharp from 'sharp'
import z from 'zod'

export default defineEventHandler(async (event) => {
  const { filename } = await getValidatedRouterParams(
    event,
    z.object({
      filename: z.string(),
    }).parse,
  )
  const imagePath = resolveStoragePath('uploads', 'public/images', basename(filename, '.webp'))
  const thumbPath = resolveStoragePath('uploads', 'public/thumbs', filename)

  if (!existsSync(imagePath)) {
    await useStorage('uploads/public/images').removeItem(filename)
    throw createError({ statusCode: 404 })
  }

  const user = await useSessionUser()

  const image = await useDatabase().query.images.findFirst({
    where: (t, { eq }) => eq(t.filename, basename(filename, '.webp')),
    with: {
      project: {
        with: {
          users: {
            where: ({ userId }, { eq }) => eq(userId, user.id),
            limit: 1,
          },
        },
      },
    },
  })
  if (!image?.project.users.length) throw createError({ statusCode: 404 })

  if (!existsSync(thumbPath)) {
    await sharp(imagePath)
      .resize({
        width: 640,
        height: 640,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp()
      .toFile(thumbPath)
  }

  return sendStream(event, createReadStream(thumbPath))
})
