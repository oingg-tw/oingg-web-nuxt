import type { Stock } from '~/composables/stock/useStocks'
import type { StockSummary } from '~/composables/stock/useStockSummary'

// One call per /stock/:code sub-page (2026-09-19, the stock-detail a11y/SEO redesign) — owns
// everything <head>-related those six pages used to do inconsistently or not at all: before this,
// index.vue set a canonical but NO <title>, no page anywhere had a description/og/twitter tag, and
// none had BreadcrumbList structured data despite the 2-level URL hierarchy.
//
// Title is「{短名} {代碼} {主題}」— identical to the page's single <h1> (StockSummaryCard.vue) on
// purpose, and deliberately neutral per this app's own compliance wording rules: a page is
// 「台積電 2330 公司健檢」, never「台積電 可以買嗎」. The brand suffix comes from app.vue's global
// titleTemplate.
//
// Description is built from numbers that already exist at SSR time (useStockSummary's price/
// PE/PB/殖利率 — awaited useAsyncData, so crawlers see real values), in the same flat "number +
// neutral label" form the visible page uses. No adjectives anywhere (刪形容詞測試: delete every
// adjective and the sentence must still mean the same thing). Missing numbers drop their clause
// rather than printing a placeholder — a description that says「資料不足」on thousands of pages
// is thin duplicate text, not information. Once useStockPageDigest lands, pages pass its richer
// `description` override and this fallback only covers the digest-less case.
//
// robots: the "找不到這檔股票" branch is an HTTP 200 (a soft 404 — the summary fetch also returns
// null on a backend outage, so a real 404 would be wrong there), so it carries `noindex` instead;
// `noindex` callers (e.g. the f-score pilot's non-pilot symbols) get `noindex, follow`. Everything
// else leaves robots unset — @nuxtjs/robots' own dev-time blanket noindex still applies in dev.
//
// Breadcrumb: 首頁 › {類股} › {短名} {代碼} › {主題} — the topic crumb is back as of 2026-09-20
// per direct decision ("造訪 stock/2330/f-score 麵包屑也要跟著變"): the trail should say which
// sub-page you're on.
//
// It does overlap the <h1>, which names the same topic (StockSummaryCard.vue) — that overlap is
// deliberate and was re-confirmed the same day. A navigational trail and a page heading answer
// the same question for different readers (and the trail additionally feeds BreadcrumbList
// structured data); the h1's own copy of the topic is what keeps a symbol's 7 sub-pages from all
// sharing one identical heading, so neither can be dropped in favour of the other.
//
// History, since this has now swung twice: the original 5-level version（首頁 › 個股總表 › 類股 ›
// 個股 › 主題, plus an optional `parent` step for f-score under 公司健檢）was cut to 3 on
// 2026-09-19 (interface-complexity review against docs/0_researches/退休族流暢數位瀏覽體驗的架構規
// 範與人機工程實踐.md, whose own guidance caps navigation depth at 3) on the reasoning that a topic
// crumb merely duplicated the <h1>. 4 levels is the settled answer: still inside that guidance,
// and 個股總表 stays out either way — it's one 找股票 header click away regardless of which stock
// page a visitor is on. The index page (empty pathSuffix) has no topic crumb; it IS the 個股 level.
//
// The sector level (from the profile's own exchange code resolved against
// shared/utils/hub-slugs.ts) is simply skipped when the profile hasn't loaded or the code isn't
// an industry. The same array feeds the visible <nav aria-label="麵包屑"> (StockBreadcrumb.vue)
// and the JSON-LD, so the two can't drift.
export interface StockBreadcrumbItem {
  label: string
  to: string
}

export interface StockPageSeoOptions {
  code: Ref<string>
  shortName: Ref<string>
  topic: string
  // Head-term phrase for the <title>（「股利、殖利率與配息紀錄」）— the h1 keeps the short `topic`
  // (2026-09-19, the SEO build: entity first, then the words people search with). Falls back to
  // `topic`. Kept ≤ 32 CJK-equivalent characters with the brand suffix by scripts/check-stock-pages.mjs.
  titleKeywords?: string
  // Path after `/stock/{code}` — '' for the index page, '/dividend', '/metrics-history', …
  pathSuffix: string
  stock: Ref<Stock | undefined>
  // useAsyncData's own `data` type — `undefined` before the first fetch, `null` when the backend
  // had nothing.
  summary: Ref<StockSummary | null | undefined>
  // Richer, digest-built description when the page has one; falls back to the summary-based
  // sentence below when absent or empty.
  description?: Ref<string | null | undefined>
  // A Ref is accepted so a page can decide per symbol (the f-score pilot).
  noindex?: boolean | Ref<boolean>
  // The company's 證交所類股 code（profile.industry）for the breadcrumb's sector level.
  sectorCode?: Ref<string | null | undefined>
}

function fallbackDescription(shortName: string, code: string, topic: string, summary: StockSummary | null | undefined): string {
  const lead = `${shortName}（${code}）${topic}`
  const clauses: string[] = []
  const price = summary?.price
  const valuation = summary?.valuation
  if (price) clauses.push(`${price.tradeDate} 收盤 ${price.close.toFixed(2)} 元`)
  if (valuation?.peRatio != null) clauses.push(`本益比 ${valuation.peRatio.toFixed(2)} 倍`)
  if (valuation?.pbRatio != null) clauses.push(`淨值比 ${valuation.pbRatio.toFixed(2)} 倍`)
  if (valuation?.dividendYield != null) clauses.push(`殖利率 ${valuation.dividendYield.toFixed(2)}%`)
  if (!clauses.length) return `${lead}：安盈選股整理的公開財報數據。`
  return `${lead}：${clauses.join('，')}。資料來源：台灣證券交易所、公開資訊觀測站。`
}

export function useStockPageSeo(options: StockPageSeoOptions) {
  const requestUrl = useRequestURL()
  const origin = requestUrl.origin

  const pagePath = computed(() => `/stock/${options.code.value}${options.pathSuffix}`)
  const pageUrl = computed(() => `${origin}${pagePath.value}`)
  const title = computed(() => `${options.shortName.value} ${options.code.value} ${options.titleKeywords ?? options.topic}`)
  const description = computed(() => {
    const override = options.description?.value
    return override && override.length > 0 ? override : fallbackDescription(options.shortName.value, options.code.value, options.topic, options.summary.value)
  })
  const robots = computed<string | undefined>(() => {
    if (unref(options.noindex)) return 'noindex, follow'
    return options.stock.value ? undefined : 'noindex'
  })

  const breadcrumbs = computed<StockBreadcrumbItem[]>(() => {
    const items: StockBreadcrumbItem[] = [{ label: '首頁', to: '/' }]
    const sectorCode = options.sectorCode?.value
    const sector = sectorCode ? SECTORS[sectorCode] : undefined
    const sectorTo = sectorCode ? sectorPath(sectorCode) : null
    if (sector && sectorTo) items.push({ label: sector.name, to: sectorTo })
    items.push({ label: `${options.shortName.value} ${options.code.value}`, to: `/stock/${options.code.value}` })
    if (options.pathSuffix) items.push({ label: options.topic, to: pagePath.value })
    return items
  })

  useSeoMeta({
    title,
    description,
    ogTitle: title,
    ogDescription: description,
    ogType: 'website',
    ogUrl: pageUrl,
    ogSiteName: '安盈選股',
    ogLocale: 'zh_TW',
    twitterCard: 'summary',
    robots
  })

  useHead({
    link: [{ rel: 'canonical', href: pageUrl }],
    script: [
      {
        type: 'application/ld+json',
        innerHTML: computed(() =>
          JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: breadcrumbs.value.map((item, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: item.label,
              item: `${origin}${item.to}`
            }))
          })
        )
      }
    ]
  })

  return { title, description, breadcrumbs }
}
