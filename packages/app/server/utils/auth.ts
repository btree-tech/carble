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
    username({
      usernameValidator: (username) => {
        return /^[a-zA-Z0-9_-]+$/.test(username)
      },
    }),
  ],
  user: {
    deleteUser: {
      enabled: true,
    },
  },
  advanced: {
    ipAddress: {
      // 直接公開していてプロキシの X-Forwarded-For が届かないため、クライアントの IP は判定できない。
      // 判定できないままだと全ユーザーが 1 つのレート制限の枠を共有し、通常の利用でも 429 になるので、
      // IP の判定を止める（IP で数えるレート制限はかからない。1.4 系で IP が取れないときと同じ動き）
      disableIpTracking: true,
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
