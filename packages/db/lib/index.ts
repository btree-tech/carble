import type { ResultSet } from '@libsql/client'
import type { LibSQLDatabase } from 'drizzle-orm/libsql'
import { drizzle } from 'drizzle-orm/libsql'
import { connectForE2e } from './e2e'
import type { Schema } from './helper'
import * as schema from './schema'

export * from './helper'

export type LibSQLResultSet = ResultSet

export type Database = LibSQLDatabase<Schema>

export function connect(path: string) {
  // E2E テストのアプリ（docker-compose.e2e.yml）だけ、ロックで失敗しないよう手を入れた接続を使う（e2e.ts）
  if (process.env.CARBLE_E2E === '1') return connectForE2e(path)

  return drizzle({
    schema,
    connection: {
      url: path,
    },
    logger: process.env.NODE_ENV !== 'production',
  })
}
