// https://nuxt.com/docs/api/configuration/nuxt-config
import { generateRuntimeConfig } from './server/utils/runtimeConfig'

export default defineNuxtConfig({

  modules: [
    '@nuxt/eslint',
    '@nuxt/ui'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],
  runtimeConfig: generateRuntimeConfig(),

  routeRules: {},

  compatibilityDate: '2025-01-15',

  nitro: {
    experimental: {
      websocket: true
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
