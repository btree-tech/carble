import { fields, projects } from '@carble/db/schema'

export default defineEventHandler(async () => {
  return await useDatabase().transaction(async (tx) => {
    const [project] = await tx.insert(projects)
      .values({
        name: '無題のプロジェクト',
      })
      .returning()

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

    return project
  })
})
