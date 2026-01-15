import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { connect } from './packages/db/lib'
import config from './packages/db/drizzle.config'
import { pathToFileURL } from 'node:url'
import { username } from 'better-auth/plugins'

export const auth = betterAuth({
  database: drizzleAdapter(connect(pathToFileURL(config.dbCredentials.url).toString()), {
    provider: 'sqlite',
    usePlural: true,
  }),
  plugins: [
    username(),
  ],
})
