import type { LibSQLDatabase } from 'drizzle-orm/libsql'
import * as schema from './schema'

export type Schema = typeof schema

export type SchemaKey = keyof Schema

export type TableKey = keyof Omit<Schema, `${string}Relations`>

export type RelationKey = keyof Omit<Schema, TableKey>

export type Database = LibSQLDatabase<Schema>

export type RelationalQueryBuilderConfig<K extends TableKey, M extends keyof Database['query'][TableKey]> = NonNullable<Parameters<Database['query'][K][M]>[0]>

export function table<T extends TableKey>(key: T): Schema[T] {
  return schema[key]
}

export function field<T extends TableKey, F extends keyof Schema[T]>(table: T, field: F): Schema[T][F] {
  return schema[table][field]
}
