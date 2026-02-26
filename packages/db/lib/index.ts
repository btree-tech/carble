import type { ResultSet } from '@libsql/client'
import type { LibSQLDatabase } from 'drizzle-orm/libsql'
import { drizzle } from 'drizzle-orm/libsql'
import type { Schema } from './helper'
import * as schema from './schema'

export * from './helper'

export type LibSQLResultSet = ResultSet

export type Database = LibSQLDatabase<Schema>

export function connect(path: string) {
  return drizzle({
    schema,
    connection: {
      url: path,
    },
    logger: process.env.NODE_ENV !== 'production',
  })
}
