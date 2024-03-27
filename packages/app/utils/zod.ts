import { createSelectSchema as _createSelectSchema } from 'drizzle-zod'
import type { Table } from 'drizzle-orm'
import type { z } from 'zod'

export function createCoersionSchema<Schema extends z.ZodTypeAny>(schema: Schema) {
  if (!('shape' in schema)) return schema

  return
}
