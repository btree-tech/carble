import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type { Schema } from './helper'
import * as schema from './schema'

export * from './helper'

export type Database = BetterSQLite3Database<Schema>

export function connect(path: string) {
  const client = new Database(path)
  const db = drizzle<Schema>(client, {
    schema,
    logger: process.env.NODE_ENV !== 'production',
  })

  return db
}
