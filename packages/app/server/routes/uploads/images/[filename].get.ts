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

  const user = await useSessionUser()

  const image = await useDatabase().query.images.findFirst({
    where: (t, { eq }) => eq(t.filename, filename),
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

  return sendStream(event, createReadStream(path))
})
