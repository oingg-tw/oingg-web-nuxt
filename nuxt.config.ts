// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  // @nuxt/content installed 2026-09-06, wired to blog/index.vue and blog/[slug].vue 2026-09-07
  // — content/blog/*.md (see content.config.ts) is now the only source for blog posts, the old
  // useBlogPosts.ts hand-written array is gone.
  modules: ['@element-plus/nuxt', '@nuxtjs/robots', '@nuxtjs/sitemap', '@nuxt/content'],
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
  // env check needed/added here. Verified live 2026-09-20, three independent layers in dev:
  // /robots.txt is `User-agent: * / Disallow: /`, the response carries
  // `x-robots-tag: noindex, nofollow`, and every page's own <meta name="robots"> says the same.
  // The header is the strongest of the three — it covers non-HTML responses too.
  //
  // CORRECTION 2026-09-20: this comment used to say `mergeWithRobotsTxtPath` picks up an existing
  // public/robots.txt carrying `Disallow: /profile, /calendar`. There is no such file — commit
  // 34dc66b, the one that added this module, deleted it (correctly: the module generates
  // robots.txt itself). The personal pages are still kept out of search, just by the other two
  // mechanisms rather than that one: each declares `robots: 'noindex, nofollow'` in its own
  // useSeoMeta (verified on /profile and /calendar), and all of them sit in `sitemap.exclude`
  // below. If a robots.txt `Disallow` is ever wanted as a third layer, it belongs in this options
  // object (`disallow: [...]`), not in a hand-maintained public file.
  robots: {},
  // @nuxtjs/sitemap auto-discovers static routes from app/pages/ (including /blog itself) —
  // dynamic routes need to be listed explicitly since they can't be inferred from the
  // filesystem. urls() is async so it can pull the real published-post list at build/request
  // time instead of hand-maintaining a duplicate list here that would silently drift out of
  // sync with the actual posts.
  //
  // Split into two sitemaps under one index (2026-09-19): `pages` (the static app routes plus
  // the blog posts below) and `stocks` (~13,000 per-stock URLs, fed at request time by the Nitro
  // handler server/api/__sitemap__/stocks.get.ts, chunked). The stock list lives in bff-ts, so it
  // can't be enumerated here at build time the way the blog's own markdown files can.
  sitemap: {
    // Per-visitor pages (settings, holdings, watchlist, profile, calendar, the internal design
    // page) carry `robots: noindex` in their own useSeoMeta and must not be advertised here either
    // — a noindex URL inside a sitemap is a contradiction Search Console reports (2026-09-19).
    exclude: ['/appearance', '/holdings', '/watchlist', '/profile', '/calendar', '/design'],
    sitemaps: {
      pages: {
        includeAppSources: true,
        urls: async () => {
          // Reads content/blog/*.md directly with a tiny hand-rolled frontmatter scan rather than
          // calling queryCollection() — this callback runs in nuxt.config.ts's Node/Nitro
          // build-time context, before the Content module's own runtime/composables are set up, so
          // queryCollection() isn't reliably available here. Only top-level scalar `key: value`
          // frontmatter lines matter for this (slug/date/status), so a full YAML parser isn't
          // needed — none of this repo's dependencies ship one at the top level of node_modules
          // (checked: js-yaml/yaml are only pnpm-nested transitive deps of @nuxt/content, not safe
          // to import directly).
          const { readdir, readFile } = await import('node:fs/promises')
          const { fileURLToPath } = await import('node:url')
          const blogDir = fileURLToPath(new URL('./content/blog', import.meta.url))
          const files = await readdir(blogDir)
          const urls: { loc: string; lastmod?: string }[] = []
          for (const file of files) {
            if (!file.endsWith('.md')) continue
            const raw = await readFile(`${blogDir}/${file}`, 'utf-8')
            const frontmatter = raw.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? ''
            const field = (name: string) => frontmatter.match(new RegExp(`^${name}:\\s*['"]?([^'"\\n]+)['"]?$`, 'm'))?.[1]
            if (field('status') !== 'published') continue
            const slug = field('slug')
            if (!slug) continue
            urls.push({ loc: `/blog/${slug}`, lastmod: field('date') })
          }
          return urls
        }
      },
      stocks: {
        sources: ['/api/__sitemap__/stocks'],
        chunks: true
      },
      // The hub pages' dynamic routes（/industry/…, /rank/…, /screener/{slug}, /metrics/{slug}）—
      // server/api/__sitemap__/hubs.get.ts, from the same cached datasets the pages render
      // (2026-09-19, the SEO build). The static hub indexes are auto-discovered under `pages`.
      hubs: {
        sources: ['/api/__sitemap__/hubs']
      }
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
      // Fallback only — pages with their own useSeoMeta({ title }) override this outright.
      // Without it, any page that doesn't set its own title showed a BLANK browser tab, not even
      // the site name — reported directly ("希望瀏覽器上面的tab要呈現網站名稱").
      title: '安盈選股',
      // The brand-suffix `titleTemplate` (「{page title}｜安盈選股」, 2026-09-19) lives in
      // app.vue's own useHead(), NOT here — `app.head` must stay serializable, and the template
      // needs to be a function (a bare '%s｜安盈選股' string would render「｜安盈選股」for pages
      // with no title of their own, instead of this bare brand fallback). Confirmed live: a
      // function here is both a typecheck error and silently ignored at runtime.
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
      ],
      // Google Analytics (gtag.js), installed 2026-09-14. Loaded site-wide here rather than per-
      // page useHead() calls so every route (including ones with no other custom head logic)
      // gets tracked — same reasoning as the title/favicon entries above. The inline config
      // script is `async: false` (Nuxt/unhead default for scripts with no `src`) but still runs
      // after the external gtag.js `async` script since Nuxt renders head scripts in array order
      // and the browser executes non-async inline scripts in document order relative to the
      // async one having already been requested — matches Google's own documented snippet
      // ordering, not reordered for any Nuxt-specific reason.
      script: [
        { src: 'https://www.googletagmanager.com/gtag/js?id=G-6SNYW0NYGL', async: true },
        {
          children: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-6SNYW0NYGL');`
        }
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
