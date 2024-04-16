import { createReadStream, existsSync } from 'node:fs'
import { resolve } from 'node:path'

export default defineEventHandler(async (event) => {
  const filename = getRouterParam(useEvent(), 'filename')!

  const dir = useStorage().getMount('uploads').driver.options.base
  const path = resolve(dir, 'public/images', filename)

  if (!existsSync(path)) throw createError({ statusCode: 404 })

  return sendStream(event, createReadStream(path))
})
