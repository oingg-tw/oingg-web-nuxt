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
// `noindex` callers (dividend-source, an A/B comparison page) get `noindex, follow`. Everything
// else leaves robots unset — @nuxtjs/robots' own dev-time blanket noindex still applies in dev.
//
// Breadcrumb: 首頁 › {短名} {代碼} › {主題}, with an optional intermediate parent (dividend-source
// sits under 配股配息). There is deliberately NO「個股」level — no /stock/ index page exists to
// point it at, and a BreadcrumbList item without a real URL is worse than a shorter trail. The
// same array feeds the visible <nav aria-label="麵包屑"> (StockBreadcrumb.vue) and the JSON-LD,
// so the two can't drift.
export interface StockBreadcrumbItem {
  label: string
  to: string
}

export interface StockPageSeoOptions {
  code: Ref<string>
  shortName: Ref<string>
  topic: string
  // Path after `/stock/{code}` — '' for the index page, '/dividend', '/company-health', …
  pathSuffix: string
  stock: Ref<Stock | undefined>
  // useAsyncData's own `data` type — `undefined` before the first fetch, `null` when the backend
  // had nothing.
  summary: Ref<StockSummary | null | undefined>
  // Richer, digest-built description when the page has one; falls back to the summary-based
  // sentence below when absent or empty.
  description?: Ref<string | null | undefined>
  noindex?: boolean
  parent?: { label: string; pathSuffix: string }
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
  const title = computed(() => `${options.shortName.value} ${options.code.value} ${options.topic}`)
  const description = computed(() => {
    const override = options.description?.value
    return override && override.length > 0 ? override : fallbackDescription(options.shortName.value, options.code.value, options.topic, options.summary.value)
  })
  const robots = computed<string | undefined>(() => {
    if (options.noindex) return 'noindex, follow'
    return options.stock.value ? undefined : 'noindex'
  })

  const breadcrumbs = computed<StockBreadcrumbItem[]>(() => {
    const items: StockBreadcrumbItem[] = [
      { label: '首頁', to: '/' },
      { label: `${options.shortName.value} ${options.code.value}`, to: `/stock/${options.code.value}` }
    ]
    if (options.parent) items.push({ label: options.parent.label, to: `/stock/${options.code.value}${options.parent.pathSuffix}` })
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
