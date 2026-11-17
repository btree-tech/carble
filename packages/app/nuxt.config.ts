import svgLoader from 'vite-svg-loader'

const rootDirURL = new URL('../../', import.meta.url)

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: {
    enabled: true,
  },

  // E2E でカバレッジを取るイメージ（docker-compose.e2e.coverage.yml）だけ、元のソースの行に対応づけるためにソースマップを出す
  sourcemap: process.env.E2E_COVERAGE === '1' ? { server: true, client: true } : undefined,

  modules: [
    '@vueuse/nuxt',
    '@nuxt/ui',
    '@nuxt/eslint',
  ],

  runtimeConfig: {
    dbPath: new URL(process.env.DB_PATH || './storage/dev.db', rootDirURL).toString(),
    basicAuth: {
      user: '',
      password: '',
    },
    auth: {
      secret: process.env.BETTER_AUTH_SECRET,
      url: process.env.BETTER_AUTH_URL,
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      },
    },
  },

  nitro: {
    storage: {
      fs: {
        driver: 'fs',
        base: '/carble/storage',
      },
      uploads: {
        driver: 'fs',
        base: '/carble/storage/uploads',
      },
    },
    devStorage: {
      fs: {
        driver: 'fs',
        base: '../../storage',
      },
      uploads: {
        driver: 'fs',
        base: '../../storage/uploads',
      },
    },
    scheduledTasks: {
      '* * * * *': ['import'],
    },
    experimental: {
      asyncContext: true,
      tasks: true,
      // E2E でカバレッジを取るイメージだけ、依存を含むソースマップの対応づけを消さない
      // （既定では消すので、サーバーのミドルウェア・utils などを元のファイルに戻せない）
      ...(process.env.E2E_COVERAGE === '1' ? { sourcemapMinify: false } : {}),
    },
  },

  vite: {
    server: {
      hmr: {
        port: Number(process.env.APP_HMR_PORT) || 24678,
      },
    },
    plugins: [svgLoader()],
  },
})
