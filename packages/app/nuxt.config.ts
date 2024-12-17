import { fileURLToPath } from 'node:url'

const rootDirURL = new URL('../../', import.meta.url)

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: {
    enabled: true,

    timeline: {
      enabled: true,
    },
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
      uploads: {
        driver: 'fs',
        base: '/carble/storage/uploads',
      },
    },
    devStorage: {
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
  },
})