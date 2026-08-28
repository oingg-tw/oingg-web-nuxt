// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@element-plus/nuxt'],
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      htmlAttrs: { class: 'dark', lang: 'zh-Hant' },
      // No maximum-scale/user-scalable lock here — WCAG 1.4.4 (Resize Text, AA)
      // requires users can still zoom to 200%+; this only fixes the layout width,
      // it must never cap zoom.
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }]
    }
  },
  runtimeConfig: {
    public: {
      apiBase: 'http://localhost:4000',
      firebase: {
        apiKey: '',
        authDomain: '',
        projectId: '',
        storageBucket: '',
        messagingSenderId: '',
        appId: '',
        measurementId: ''
      }
    }
  }
})
