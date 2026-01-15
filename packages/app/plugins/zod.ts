import { z } from 'zod'
import ja from 'zod/v4/locales/ja.js'

export default defineNuxtPlugin({
  setup: () => {
    z.config(ja())
  },
})
