export default defineEventHandler(() => {
  if (!useDatabase()) {
    createDatabase()
  }
})
