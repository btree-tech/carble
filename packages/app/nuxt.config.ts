import { fileURLToPath } from 'node:url'

const rootDirURL = new URL('../../', import.meta.url)

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },

  modules: [
    '@vueuse/nuxt',
    '@nuxt/ui',
    '@nuxt/eslint',
  ],

  runtimeConfig: {
    dbPath: fileURLToPath(new URL(process.env.DB_PATH || './storage/dev.db', rootDirURL)),
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
    alias: {
      'file-type': fileURLToPath(new URL('node_modules/file-type/index.js', import.meta.url)),
    },
  },

  vite: {
    server: {
      hmr: {
        port: Number(process.env.APP_HMR_PORT) || 24678,
      },
    },
  },

  ui: {
    icons: ['material-symbols-light'],
  },
})