// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@element-plus/nuxt', '@nuxtjs/robots', '@nuxtjs/sitemap'],
  // Real production domain (see docs/0_researches/oingg.com 首頁背景漸層設計研究報告.md — the
  // actual intended domain, currently just a Squarespace placeholder, not deployed yet per
  // this repo's own memory of "zero deploy config"). Both @nuxtjs/robots and @nuxtjs/sitemap
  // need this for absolute URLs (sitemap <loc> entries, the "Sitemap:" line in robots.txt).
  site: {
    url: 'https://oingg.com'
  },
  // @nuxtjs/robots ships "disable non-production environments from being indexed" as a
  // built-in default (confirmed in its own README) — this is what actually satisfies "確保站在
  // dev環境是隱身的": running `nuxt dev` renders a blanket Disallow, verified live. No manual
  // env check needed/added here. mergeWithRobotsTxtPath defaults to true and reads
  // <publicDir>/robots.txt automatically, so the existing public/robots.txt (Disallow: /profile,
  // /dashboard) keeps applying in production on top of the module's own generated rules —
  // nothing there needed to change or move.
  robots: {},
  // @nuxtjs/sitemap auto-discovers static routes from app/pages/ (including /blog itself) —
  // dynamic routes need to be listed explicitly since they can't be inferred from the
  // filesystem. urls() is async so it can pull the real slug list from useBlogPosts() at
  // build/request time instead of hand-maintaining a duplicate list here that would silently
  // drift out of sync with the actual posts.
  sitemap: {
    urls: async () => {
      // Imports the plain exported array directly, NOT the useBlogPosts() composable — this
      // runs in nuxt.config.ts's Node/Nitro build-time context, not a Vue component context,
      // so going through computed() would be unnecessary overhead/risk for a one-off read.
      const { BLOG_POSTS } = await import('./app/composables/blog/useBlogPosts')
      return BLOG_POSTS.map(post => ({ loc: `/blog/${post.slug}`, lastmod: post.publishedAt }))
    }
  },
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
      // Fallback only — most pages with their own useSeoMeta({ title }) override this outright
      // (Nuxt's per-page title always wins over this default, no titleTemplate needed to merge
      // them). Without it, any page that doesn't set its own title (dashboard.vue, screener,
      // stock detail, profile...) showed a BLANK browser tab, not even the site name — reported
      // directly ("希望瀏覽器上面的tab要呈現網站名稱").
      title: '安盈選股',
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
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;600;700&display=swap' },
        // favicon.ico itself is auto-detected at /favicon.ico by browser convention even
        // without this, but an explicit <link> is still the more robust/modern approach (some
        // browsers/contexts skip the convention, e.g. when the page has a <base> tag or is
        // served from a non-root path). 2026-09-06: regenerated as a real multi-resolution ICO
        // (16/32/48px, embedded PNG frames) — was a single fixed 32x32 frame before, which
        // looks soft/pixelated wherever a browser wants a smaller or larger size. Rebuilt again
        // same day from a user-supplied source matching the new public/images/logo.svg mark.
        // apple-touch-icon.png (180x180, white background — iOS fills transparent areas with
        // black otherwise) still derived from the earlier PNG mark, not yet regenerated from
        // this new one.
        // Deliberately NOT adding a web app manifest / 192px+512px PWA icon set alongside
        // these — there's no manifest.json or other PWA infrastructure in this app yet, and
        // shipping icon files for a capability that doesn't exist would be dead weight, not
        // future-proofing (per direct discussion: "我是確定網站用 但我不確定未來有多少使用情境").
        { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }
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
