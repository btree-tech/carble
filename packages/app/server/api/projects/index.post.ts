import { fields, projects, usersToProjects } from '@carble/db/schema'
import z from 'zod'

export default defineEventHandler(async (event) => {
  const user = await useSessionUser()

  const data = await readValidatedBody(
    event,
    z.object({
      name: z.string().optional(),
      fields: z.boolean().optional(),
    }).optional().parse,
  )

  return await useDatabase().transaction(async (tx) => {
    const [project] = await tx.insert(projects)
      .values({
        name: data?.name ?? '無題のプロジェクト',
      })
      .returning()

    await tx.insert(usersToProjects)
      .values({
        userId: user.id,
        projectId: project.id,
      })

    if (data?.fields) {
      await tx.insert(fields)
        .values([
          {
            projectId: project.id,
            name: 'みだし',
            order: 1,
          },
          {
            projectId: project.id,
            name: 'メモ',
            order: 2,
          },
        ])
    }

    return project
  })
})
