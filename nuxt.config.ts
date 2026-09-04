// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@element-plus/nuxt'],
  // Nuxt's own composables/ auto-import default only scans the top-level directory plus
  // one level of *`/index.ts` files — a nested composables/<domain>/useXxx.ts layout (see
  // that folder's own organization, split by domain since it outgrew a single flat
  // directory) is invisible to it without this. Confirmed live: without this entry, every
  // composable under a subfolder came back "is not defined" at runtime (SSR crash on
  // app.vue) even though vue-tsc's path-alias resolution stayed green the whole time —
  // type-checking and Nuxt's runtime auto-import are two independent mechanisms, only one
  // of which this config actually controls.
  imports: { dirs: ['composables/**'] },
  // Default is 'en' — every other string in this app is 繁體中文, so el-pagination's
  // "20/page", el-date-picker's month names, etc. would be the one inconsistently-English
  // corner left otherwise. zh-tw (not zh-cn) to match htmlAttrs.lang below.
  elementPlus: { defaultLocale: 'zh-tw' },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      // class/data-theme-color/data-market are NOT set here — useAppTheme.ts's own useHead()
      // call owns those reactively (cookie-backed, so it renders correctly server-side on
      // every request, not just after client hydration). Setting them here too would just
      // create a second, conflicting source for the same attributes.
      htmlAttrs: { lang: 'zh-Hant' },
      // No maximum-scale/user-scalable lock here — WCAG 1.4.4 (Resize Text, AA)
      // requires users can still zoom to 200%+; this only fixes the layout width,
      // it must never cap zoom.
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
      // Noto Sans TC — only the 4 weights actually used across the app (400/500/600/700;
      // see main.css's own font-family rule) rather than all 9 Google serves, since CJK
      // subsets are heavy per weight. display=swap so text renders in the fallback stack
      // immediately and swaps in once the webfont arrives, instead of staying invisible
      // (FOIT) on a slow connection — the preconnects shave the DNS/TLS handshake off the
      // critical path for both the stylesheet host and the actual font-file host.
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;600;700&display=swap' }
      ]
    }
  },
  runtimeConfig: {
    public: {
      apiBase: 'http://localhost:4000',
      // Brandfetch Logo API's own client ID — a public identifier meant to be used directly
      // in frontend request URLs (not a secret), confirmed live 2026-09-04 against
      // https://cdn.brandfetch.io/notion.so/fallback/404/icon?c=<id>. See
      // project_company_logo_source_pending memory for the vendor-selection rationale
      // (Clearbit's own Logo API shut down 2025-12-01).
      brandfetchClientId: '',
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
