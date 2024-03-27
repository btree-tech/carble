import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import type { Schema } from './helper'
import * as schema from './schema'

export * from './helper'

export function connect() {
  const client = new Database('../../storage/dev.db')
  const db = drizzle<Schema>(client, {
    schema,
    logger: true,
  })

  return db
}
