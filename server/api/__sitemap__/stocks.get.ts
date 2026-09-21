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
// Per symbol: the seven indexable sub-pages（/, dividend, metrics-history, financial-statements,
// balance-sheet, income-statement, cash-flow-statement）, NOT etf/preferred symbols (no page
// under /stock/ for them). company-health was dropped 2026-09-19 when that page was unpublished
// (see app/pages/stock/[code]/company-health.vue's own comment). The three statement pages
// joined 2026-09-20 when financial-statements.vue's own latest-filing tables split out into their
// own URLs (see balance-sheet.vue's own top comment). /f-score and every BADGE_PAGES slug (the
// badge-page family, app/pages/stock/[code]/[slug].vue) only for the pilot batch — see
// shared/utils/f-score-pilot.ts; they share the same gate on purpose, not a coincidence — the
// badge pages reuse f-score's exact "watch indexing before widening" reasoning.
//
// Four-digit codes only: GET /stocks also carries 31 six-digit codes（e.g. 000601 牛牛牛亞,
// 000646 大昌證券 — public-but-unlisted companies）that have no quote at all, so their /stock/
// page is the「找不到這檔股票」soft-404 with `noindex` (checked on the production build
// 2026-09-19). Listing a noindex page in a sitemap is a contradiction Search Console reports.
// Same for the four-digit codes bff-ts files under a non-industry sector（sectorCode null —
// 07/91/98/XX）: scripts/check-click-depth.mjs sampled 25 of them on 2026-09-19 and every one was
// that soft-404, so only symbols with an exchange sector are listed（the /stock directory shows
// the same population）.
const LISTED_SYMBOL = /^\d{4}$/
// /margins（財報三率）and /solvency（安全韌性的組成）joined 2026-09-21 unconditionally rather than
// behind the pilot gate below: each is ONE new suffix for every symbol (~2,600 URLs), the same
// footprint the three statement pages each added on 2026-09-20, not a per-symbol × per-metric
// family. Financials render both with no numbers（no comparable 營業收入 line on one, no
// 流動／非流動 split on the other）and self-noindex, the same soft-404-ish condition several of
// these suffixes already have per symbol.
const INDEXABLE_SUFFIXES = ['', '/dividend', '/margins', '/solvency', '/metrics-history', '/financial-statements', '/balance-sheet', '/income-statement', '/cash-flow-statement']
const PAGE_LIMIT = 1000

interface StocksCollectionResponse {
  count: number
  entries: { symbol: string; sectorCode?: string | null }[]
}

// The METRIC_PAGES entries that are indexable RIGHT NOW. A metric page self-noindexes when its
// catalog `description` is null (StockMetricDetailPage.vue's own `noindex` computed), and listing
// a noindex URL in a sitemap is the contradiction Search Console reports — the same rule that held
// this whole family out of the sitemap for a few hours on 2026-09-20 while `eps` had no copy yet.
// That all-or-nothing hold was workable while the family was small and its copy landed together;
// it stopped being so on 2026-09-21, when `operating-margin` shipped as one entry without copy
// alongside four that had it (see METRIC_PAGES' own comment on that entry) — holding the family
// out would have cost four good page families to protect one. Its copy landed hours later and it
// rejoined by itself, 0 → 176 URLs, which is the whole point of the mechanism: every entry can
// now ship the moment its DATA is real, ahead of its prose, without anyone tracking the gap.
// Derived from the live catalog rather than kept as a hand-maintained
// exclusion list: an entry starts being listed the moment analysis-ts writes its text, and stops
// if one is ever cleared, with no edit here or in hub-slugs.ts to remember. The catalog call is
// the shared cached one, so this costs at most one bff request per sitemap build.
//
// Falls OPEN (lists everything) if that call fails, deliberately: the worse of the two failure
// modes is a whole page family silently vanishing from the sitemap over a transient outage, not
// one noindex URL briefly appearing in it.
async function indexableMetricPages(): Promise<typeof METRIC_PAGES> {
  try {
    const catalog = await getMetricsCatalog() as { categories: { metrics: { key: string; description: string | null }[] }[] }
    const described = new Set(catalog.categories.flatMap(category => category.metrics).filter(metric => metric.description).map(metric => metric.key))
    return METRIC_PAGES.filter(page => described.has(page.metricCode))
  } catch {
    return METRIC_PAGES
  }
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
    symbols.push(...response.entries.filter(entry => entry.sectorCode && SECTORS[entry.sectorCode]).map(entry => entry.symbol))
    offset += response.entries.length
  }
  const metricPages = await indexableMetricPages()
  const urls: { loc: string }[] = []
  for (const symbol of symbols) {
    if (!LISTED_SYMBOL.test(symbol)) continue
    for (const suffix of INDEXABLE_SUFFIXES) urls.push({ loc: `/stock/${symbol}${suffix}` })
    // One loop over BADGE_PAGES covers f-score too since 2026-09-20 — it used to be pushed
    // separately because it wasn't in that registry, which is exactly how its entry point on the
    // stock page ended up living somewhere different from the other three badges'.
    if (isFScorePilotSymbol(symbol)) for (const badgePage of BADGE_PAGES) urls.push({ loc: `/stock/${symbol}/${badgePage.slug}` })
    // METRIC_PAGES (the 指標專頁 family) joins on the SAME pilot gate, for the same reason: this
    // is a per-symbol × per-metric page family that could add thousands of URLs at once, and
    // 2026-09-19's call was to watch how the first batch indexes before widening. It was held out
    // entirely for a few hours on 2026-09-20 while `eps` still had a null `description` — those
    // pages self-noindex without one (StockMetricDetailPage's own computed), and a noindex URL in
    // a sitemap is the contradiction Search Console reports. analysis-ts filled that copy in
    // 9153f246, so they are indexable now — and that all-or-nothing hold became the per-entry
    // filter above (indexableMetricPages()) on 2026-09-21, which is what `metricPages` is here.
    if (isFScorePilotSymbol(symbol)) for (const metricPage of metricPages) urls.push({ loc: `/stock/${symbol}/${metricPage.slug}` })
  }
  return urls
})
