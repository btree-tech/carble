import { createReadStream, existsSync } from 'node:fs'

export default defineEventHandler(async (event) => {
  const filename = getRouterParam(useEvent(), 'filename')!

  const path = resolveStoragePath('uploads', 'public/images', filename)

  if (!existsSync(path)) throw createError({ statusCode: 404 })

  return sendStream(event, createReadStream(path))
})
