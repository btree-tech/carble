import { connect } from '@carble/db'

export default defineEventHandler(async () => {
  return await connect().query.projects.findMany({
    orderBy: ({ updatedAt }, { desc }) => desc(updatedAt),
  })
})
