import { type Database, connect } from '@carble/db'

let db: Database

export function createDatabase() {
  const { dbPath } = useRuntimeConfig()
  db = connect(dbPath)
}

export function useDatabase() {
  return db
}
