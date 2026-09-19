// Dynamic sitemap source for the per-stock pages (2026-09-19) — @nuxtjs/sitemap can only
// auto-discover static routes from app/pages/, so /stock/{code}/… has to be enumerated here.
// Runs in Nitro (server-side, same as system-health.get.ts), paging through bff-ts's GET /stocks
// exactly the way useCompanyIndex.ts's fetchCommonStocks() does in the browser (limit 1000, no
// upper bound on offset; ~2,650 common-stock symbols as of this date). useCompanyIndex itself
// can't be reused: it's a Nuxt app composable (useRuntimeConfig()/useAsyncData), not importable
// into nuxt.config.ts or a Nitro handler.
//
// A plain defineEventHandler returning `{ loc }` objects: the module's own
// defineSitemapEventHandler is literally an alias of defineEventHandler and asSitemapUrl an
// identity helper (checked in its dist/runtime/server/composables), and neither is typed on the
// server-side `#imports` here (vue-tsc: "has no exported member") — so the plain form is both
// simpler and the one that type-checks.
//
// Per symbol: the five indexable sub-pages（/, dividend, company-health, metrics-history,
// financial-statements）, NOT etf/preferred symbols (no page under /stock/ for them). /f-score
// only for the pilot batch — see shared/utils/f-score-pilot.ts.
//
// Four-digit codes only: GET /stocks also carries 31 six-digit codes（e.g. 000601 牛牛牛亞,
// 000646 大昌證券 — public-but-unlisted companies）that have no quote at all, so their /stock/
// page is the「找不到這檔股票」soft-404 with `noindex` (checked on the production build
// 2026-09-19). Listing a noindex page in a sitemap is a contradiction Search Console reports.
const LISTED_SYMBOL = /^\d{4}$/
const INDEXABLE_SUFFIXES = ['', '/dividend', '/company-health', '/metrics-history', '/financial-statements']
const PAGE_LIMIT = 1000

interface StocksCollectionResponse {
  count: number
  entries: { symbol: string }[]
}

export default defineEventHandler(async event => {
  const config = useRuntimeConfig(event)
  const symbols: string[] = []
  let offset = 0
  let total = Infinity
  while (offset < total) {
    const response = await $fetch<StocksCollectionResponse>('/stocks', {
      baseURL: config.public.apiBase,
      query: { limit: PAGE_LIMIT, offset },
      retry: 0,
      timeout: 15000
    })
    total = response.count
    if (!response.entries.length) break
    symbols.push(...response.entries.map(entry => entry.symbol))
    offset += response.entries.length
  }
  const urls: { loc: string }[] = []
  for (const symbol of symbols) {
    if (!LISTED_SYMBOL.test(symbol)) continue
    for (const suffix of INDEXABLE_SUFFIXES) urls.push({ loc: `/stock/${symbol}${suffix}` })
    if (isFScorePilotSymbol(symbol)) urls.push({ loc: `/stock/${symbol}/f-score` })
  }
  return urls
})
