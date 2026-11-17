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
    ipAddress: ipAddressOptions(),
  },
})

/**
 * クライアントの IP の取り方（レート制限とセッションの記録に使う）
 *
 * - nginx などのプロキシの後ろに置くときは、プロキシが付けるヘッダーと、プロキシの IP を環境変数で渡す
 *   - BETTER_AUTH_IP_HEADERS: IP を読むヘッダー（カンマ区切り。既定 x-forwarded-for）
 *   - BETTER_AUTH_TRUSTED_PROXIES: プロキシの IP・CIDR（カンマ区切り）。X-Forwarded-For の右から、これに当たるものを飛ばした最初の IP を使う
 * - どちらも無いとき（プロキシを通さず直接公開・E2E）は IP を判定しない。
 *   判定できないままだと全ユーザーが 1 つのレート制限の枠を共有し、通常の利用でも 429 になるため（IP で数えるレート制限はかからない）
 */
function ipAddressOptions() {
  const ipAddressHeaders = splitEnv(process.env.BETTER_AUTH_IP_HEADERS)
  const trustedProxies = splitEnv(process.env.BETTER_AUTH_TRUSTED_PROXIES)
  if (ipAddressHeaders.length === 0 && trustedProxies.length === 0) {
    return { disableIpTracking: true }
  }
  return {
    ...(ipAddressHeaders.length > 0 && { ipAddressHeaders }),
    ...(trustedProxies.length > 0 && { trustedProxies }),
  }
}

function splitEnv(value: string | undefined) {
  return (value ?? '').split(',').map(v => v.trim()).filter(Boolean)
}

export async function useSessionUser() {
  const session = await auth.api.getSession({ headers: useEvent().headers })
  if (!session) {
    throw createError({ status: 401 })
  }
  return session.user
}
