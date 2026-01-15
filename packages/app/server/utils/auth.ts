import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { username } from 'better-auth/plugins'

export const auth = betterAuth({
  database: drizzleAdapter(useDatabase(), {
    provider: 'sqlite',
    usePlural: true,
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  plugins: [
    username(),
  ],
  user: {
    deleteUser: {
      enabled: true,
    },
  },
})

export async function useSessionUser() {
  const session = await auth.api.getSession({ headers: useEvent().headers })
  if (!session) {
    throw createError({ status: 401 })
  }
  return session.user
}
