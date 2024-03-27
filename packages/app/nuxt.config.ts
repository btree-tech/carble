import { fileURLToPath } from 'node:url'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },

  modules: [
    '@vueuse/nuxt',
    '@nuxt/ui',
  ],

  nitro: {
    storage: {
      uploads: {
        driver: 'fs',
        base: '/storage/uploads',
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

  ui: {
    icons: ['material-symbols-light'],
  },
})