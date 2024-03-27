import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

export type Schema = typeof schema

export type SchemaKey = keyof Schema

export type TableKey = keyof Omit<Schema, `${string}Relations`>

export type RelationKey = keyof Omit<Schema, TableKey>

export type DB = BetterSQLite3Database<Schema>

export type RelationalQueryBuilderConfig<K extends TableKey, M extends keyof DB['query'][TableKey]> = NonNullable<Parameters<DB['query'][K][M]>[0]>

export function table<T extends TableKey>(key: T): Schema[T] {
  return schema[key]
}

export function field<T extends TableKey, F extends keyof Schema[T]>(table: T, field: F): Schema[T][F] {
  return schema[table][field]
}
