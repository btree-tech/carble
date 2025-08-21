import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'

export * from './helper'

export function connect(path: string) {
  return drizzle({
    schema,
    connection: {
      url: path,
    },
    logger: process.env.NODE_ENV !== 'production',
  })
}
