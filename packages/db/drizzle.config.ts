import type { Config } from 'drizzle-kit'

export default {
  schema: './lib/schema.ts',
  out: './migrations',
  driver: 'better-sqlite',
  dbCredentials: {
    url: '../../storage/dev.db',
  },
} satisfies Config
