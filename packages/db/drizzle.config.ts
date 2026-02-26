import type { Config } from 'drizzle-kit'
import { fileURLToPath } from 'node:url'

const rootDirURL = new URL('../../', import.meta.url)

export default {
  schema: [
    fileURLToPath(new URL('./lib/schema/index.ts', import.meta.url)),
  ],
  out: './migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: fileURLToPath(new URL(process.env.DB_PATH || './storage/dev.db', rootDirURL)),
  },
} satisfies Config
