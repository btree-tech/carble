import { fileURLToPath } from 'node:url'
import svgLoader from 'vite-svg-loader'

const rootDirURL = new URL('../../', import.meta.url)

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: {
    enabled: true,
  },

  modules: [
    '@vueuse/nuxt',
    '@nuxt/ui',
    '@nuxt/eslint',
  ],

  runtimeConfig: {
    dbPath: fileURLToPath(new URL(process.env.DB_PATH || './storage/dev.db', rootDirURL)),
    basicAuth: {
      user: '',
      password: '',
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
    experimental: {
      asyncContext: true,
    },
  },

  vite: {
    server: {
      hmr: {
        port: Number(process.env.APP_HMR_PORT) || 24678,
      },
    },
    plugins: [svgLoader()]
  },
})
