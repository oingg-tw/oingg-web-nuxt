// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
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
  // public/_robots.txt 是這個模組的輸入檔（它會讀進去再產生 robots.txt），裡面的 Disallow 列著個人頁；
  // 那些頁同時各自宣告 noindex、也在下面的 sitemap.exclude 裡——三層都在。
  robots: {},
  // @nuxtjs/sitemap auto-discovers static routes from app/pages/ (including /blog itself) —
  // dynamic routes need to be listed explicitly since they can't be inferred from the
  // filesystem. urls() is async so it can pull the real published-post list at build/request
  // time instead of hand-maintaining a duplicate list here that would silently drift out of
  // sync with the actual posts.
  //
  // Split into two sitemaps under one index (2026-09-19): `pages` (the static app routes plus
  // the blog posts below) and `stocks` (~13,000 per-stock URLs, fed at request time by the Nitro
  // handler server/api/__sitemap__/stocks.get.ts, chunked). The stock list lives in 業務中台, so it
  // can't be enumerated here at build time the way the blog's own markdown files can.
  sitemap: {
    // Per-visitor pages (settings, holdings, watchlist, profile, calendar, the internal design
    // page) carry `robots: noindex` in their own useSeoMeta and must not be advertised here either
    // — a noindex URL inside a sitemap is a contradiction Search Console reports (2026-09-19).
    exclude: ['/appearance', '/holdings', '/holdings/**', '/watchlist', '/watchlist/**', '/profile', '/calendar', '/auth/**', '/share/**'],
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
      // The hub pages' dynamic routes（/industry/…, /rank/…, /screener/common/{slug}, /metrics/{slug}）—
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
  // vue-echarts 的樣式（x-vue-echarts 是 display:block）原本由它的 JS 在瀏覽器裡注入：伺服器輸出的圖表容器在那之前是行內元素、高度 0，
  // JS 到了才撐開成 320px，把下面整段往下推——2026-10-18 全站量測（scripts/check-layout-shift.mjs）有圖的頁面在 1440 寬幾乎都是這一段
  //（0.07～0.16）。放進全站 CSS，第一次繪製就是對的高度。
  // 本站的全站樣式分三個檔（2026-10-21）：main.css（版面與共用元件）→ theme.css（顏色）→ element-plus.css（Element Plus 的修正）。
  // 順序有意義：同特異性時後面的贏，Element Plus 的修正要蓋過前兩個
  css: ['vue-echarts/style.css', '~/assets/css/main.css', '~/assets/css/theme.css', '~/assets/css/element-plus.css'],
  // 連結只在滑鼠移上去或鍵盤聚焦時預先載入，不是一出現在畫面上就載（2026-10-16 DEV 的 Lighthouse）：ETF 篩選結果每一列都連到
  // 有圖表的 ETF 個別頁、頁首有外觀設定，可見即預載讓每一頁一進來就抓下並執行 575 KiB 的 ECharts（ETF 篩選頁 479 KiB 沒用到），
  // 跟這一頁真正要的資源搶頻寬與 CPU。滑過去才載，點下去時多半已經載好
  experimental: {
    defaults: {
      nuxtLink: { prefetchOn: { visibility: false, interaction: true } }
    }
  },
  // 建置時替 JS／CSS 等先做好 .br／.gz，Nitro 依 Accept-Encoding 送壓縮版（App Hosting 的 preset 是 node-server＋serveStatic，
  // 靜態檔由 Nitro 自己送）。2026-10-16 量到 DEV 全部原樣傳：最大一塊 JS 588,384 bytes 就是原始大小
  nitro: { compressPublicAssets: true },
  // 篩選區首頁拿掉（2026-10-16 使用者：「screener 這一個畫面是多的，我希望預設就是跑到 screener/common 就好」）。站內連結都直接指向
  // /screener/common，這條只接住書籤、外部連結與搜尋引擎（301 讓它把 /screener 換成新網址）
  routeRules: {
    '/screener': { redirect: { to: '/screener/common', statusCode: 301 } },
    // public/images 原本沒有 Cache-Control（2026-10-16 PSI：首頁主圖 95 KB、logo 7 KB 每次造訪都重新驗證或重新下載；/_nuxt 有一年
    // immutable）。檔名沒有雜湊，所以不用 immutable：換了圖最多一天就換新
    '/images/**': { headers: { 'cache-control': 'public, max-age=86400, stale-while-revalidate=604800' } },
    // 分享連結（2026-10-19）：內容即時、關掉就要立刻失效，CDN 不能快取；不給搜尋引擎收錄；連到外站時不帶網址（token 在路徑裡）。
    // 不寫進 robots.txt：LINE、Facebook 的連結預覽要抓得到標題
    // strict-origin 而不是 no-referrer（2026-10-22）：Firebase 的 Browser key 加了網站限制，沒有 Referer 的登入請求會被擋——在分享頁登入、
    //「加到我的觀察清單」都會失敗，而且單頁應用整段沿用第一頁的政策，從分享連結進站的人之後每一頁都會被擋。strict-origin 只送網域、不送路徑，
    // token 照樣不外洩
    '/share/**': { headers: { 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow', 'referrer-policy': 'strict-origin' } }
  },
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
      // viewport 用 Nuxt 的預設（width=device-width, initial-scale=1）。不要加 maximum-scale／user-scalable：WCAG 1.4.4 要能放大到 200% 以上。
      // referrer：瀏覽器的預設值，寫出來是為了蓋掉 Nitro 錯誤頁（所有 404）固定送的 `referrer-policy: no-referrer`（2026-10-22）。Firebase 的
      // Browser key 只收自己網站送來的請求，沒有 Referer 的會被擋；單頁應用整段沿用第一頁的政策，從壞連結進到 404 頁再點站內連結的人，之後登入
      // 都會失敗。meta 會更新文件的政策，跨站只送網域、不送路徑（分享頁的 token 照樣不外洩）
      meta: [{ name: 'referrer', content: 'strict-origin-when-cross-origin' }],
      // 不載網路字型，用系統內建字（main.css 的 --el-font-family）。2026-10-16 DEV 的 Lighthouse：Noto Sans TC 每頁 17 個檔、1.1 MB，
      // 而且它的樣式表擋渲染；減成 400／700 兩個字重之後下載量一樣。使用者：「如果評測依舊不好，再改就用內建的吧」。
      link: [
        // favicon.ico itself is auto-detected at /favicon.ico by browser convention even
        // without this, but an explicit <link> is still the more robust/modern approach (some
        // browsers/contexts skip the convention, e.g. when the page has a <base> tag or is
        // served from a non-root path). 2026-09-06: regenerated as a real multi-resolution ICO
        // (16/32/48px, embedded PNG frames) — was a single fixed 32x32 frame before, which
        // looks soft/pixelated wherever a browser wants a smaller or larger size. Rebuilt again
        // same day from a user-supplied source matching the new public/images/logo.svg mark.
        // Deliberately NOT adding a web app manifest / 192px+512px PWA icon set alongside
        // these — there's no manifest.json or other PWA infrastructure in this app yet, and
        // shipping icon files for a capability that doesn't exist would be dead weight, not
        // future-proofing (per direct discussion: "我是確定網站用 但我不確定未來有多少使用情境").
        // 沒有 apple-touch-icon：public/ 裡從來沒有那個檔案，原本的 <link> 讓每台 iOS 裝置開站都 404（2026-10-08 拿掉）
        { rel: 'icon', href: '/favicon.ico', sizes: 'any' }
      ]
      // Google Analytics 只有一套：Firebase 的 getAnalytics()（app/plugins/firebase.client.ts），ID 跟著各環境的
      // NUXT_PUBLIC_FIREBASE_MEASUREMENT_ID 走。2026-09-14 在這裡另外寫死的 gtag（G-6SNYW0NYGL）2026-10-16 拿掉：不分環境，
      // 本機與 DEV 的測試流量全算進去，而且跟 Firebase 那套重複計數、gtag.js 多載兩次（Lighthouse 量到約 490 KiB）
    }
  },
  runtimeConfig: {
    // 業務中台（原 業務中台）的網址，伺服器專用（2026-10-08 起瀏覽器一律走同網域的 /api/core 與 /api/cached，見
    // server/api/core/[...path].ts）。原本是 public.apiBase，會寫進每一頁的 HTML。環境變數 NUXT_BUSINESS_BASE。
    businessBase: 'http://localhost:4000',
    // 業務中台 Cloud Run 的 IAM audience（NUXT_BUSINESS_AUDIENCE，2026-10-14）：部署環境填業務中台的服務網址，Nitro 會帶 ID token；
    // 本機與 CI 留空＝不帶身分。見 server/utils/business.ts 的 businessAuthHeaders
    businessAudience: '',
    // 證明請求來自 Nitro 的共用金鑰（業務中台 7f0d8b6）：業務中台只在金鑰相符時採用 X-Oingg-Client-Ip，未登入的請求才能
    // 依使用者 IP 分別限流，而不是全站共用 Nitro 一個 IP 的額度。環境變數 NUXT_BUSINESS_NITRO_KEY，伺服器專用。
    businessNitroKey: '',
    public: {
      firebase: {
        apiKey: '',
        authDomain: '',
        projectId: '',
        storageBucket: '',
        messagingSenderId: '',
        appId: '',
        measurementId: ''
      },
      // LINE 登入的 channel ID（公開的 client_id；secret 只在業務中台）。預設是 DEV 的「安盈選股Dev」，PRD 用
      // NUXT_PUBLIC_LINE_LOGIN_CHANNEL_ID 換成自己的 channel（同一個 provider，LINE userId 才一致）
      lineLoginChannelId: '2012073650',
      // 無障礙標章（2026-10-08）：核發後貼官方的連結與圖片網址（NUXT_PUBLIC_A11Y_MARK_URL／NUXT_PUBLIC_A11Y_MARK_IMG），
      // 空值時頁尾不渲染。
      a11yMark: {
        url: '',
        img: ''
      }
    }
  }
})
