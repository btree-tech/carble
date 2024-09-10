import { createReadStream, existsSync } from 'node:fs'
import { basename } from 'node:path'
import sharp from 'sharp'

export default defineEventHandler(async (event) => {
  const filename = getRouterParam(useEvent(), 'filename')!
  const imagePath = resolveStoragePath('uploads', 'public/images', basename(filename, '.webp'))
  const thumbPath = resolveStoragePath('uploads', 'public/thumbs', filename)

  if (!existsSync(imagePath)) {
    await useStorage('uploads/public/images').removeItem(filename)
    throw createError({ statusCode: 404 })
  }

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
