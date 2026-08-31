// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@element-plus/nuxt'],
  // Default is 'en' — every other string in this app is 繁體中文, so el-pagination's
  // "20/page", el-date-picker's month names, etc. would be the one inconsistently-English
  // corner left otherwise. zh-tw (not zh-cn) to match htmlAttrs.lang below.
  elementPlus: { defaultLocale: 'zh-tw' },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      // Must match useAppTheme.ts's own DEFAULT_MODE/DEFAULT_COLOR — this is only the
      // server-rendered starting point (so there's no light/wrong-color flash before
      // hydration), the composable is what actually drives these once real theme data
      // exists to switch them.
      htmlAttrs: { class: 'dark', 'data-theme-color': 'GOLD', 'data-market': 'ASIA', lang: 'zh-Hant' },
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
