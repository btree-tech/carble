import { createReadStream, existsSync } from 'node:fs'
import z from 'zod'

export default defineEventHandler(async (event) => {
  const { filename } = await getValidatedRouterParams(
    event,
    z.object({
      filename: z.string(),
    }).parse,
  )
  const path = resolveStoragePath('uploads', 'public/images', filename)

  if (!existsSync(path)) throw createError({ statusCode: 404 })

  return sendStream(event, createReadStream(path))
})
