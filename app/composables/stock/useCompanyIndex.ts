export interface CompanyIndexEntry {
  code: string
  name: string
  // Which page a match should navigate to (see useStockSearch.ts's goToStock) — a common stock
  // resolves to /stock/{code}, but ETF/preferred-stock symbols don't have a real detail page
  // under that route at all (GET /companies/profile 404s for both, confirmed live with
  // analysis-ts) and would 404/render nonsense there. 'preferred' routes to its own real
  // per-symbol page (preferred-stocks/[code].vue); 'etf' has no per-symbol page in this app yet,
  // so it routes to the etf-zone.vue listing instead — the closest real destination that exists
  // today, not a dead end.
  kind: 'common' | 'preferred' | 'etf'
}

interface StocksCollectionResponse {
  count: number
  limit: number
  offset: number
  entries: { symbol: string; name: string }[]
}

interface PreferredStocksResponse {
  entries: { symbol: string; name: string }[]
}

interface EtfScreenerListResponse {
  count: number
  page: number
  pageSize: number
  totalPages: number
  results: { symbol: string; shortName: string }[]
}

// Real bug fixed 2026-09-11 (reported live: "searchbar有些證券代碼找不到") — the searchbar used to
// match against useStocks.ts's own MOCK_STOCK_UNIVERSE (a hardcoded ~20-large-cap fallback list,
// since GET /api/stocks itself 404'd) — meaning the vast majority of the ~2650 real listed
// companies were simply never in the searchable set at all, not a coverage gap so much as a
// missing data source entirely. bff-ts shipped GET /stocks (commit db32ce0, a pure pass-through
// of analysis-ts's own GET /companies) specifically for this — a lightweight {symbol, name} index
// across the whole market, paginated (limit 1-1000, default 200; no upper bound on offset).
//
// Real follow-up bug fixed 2026-09-11 (reported live again: "searchbar要可以搜到 特別股 + ETF")
// — GET /companies (and so GET /stocks above) only covers twse-ts/tpex-ts's own company_profile
// (MOPS company-registration data), which ETF/preferred-stock symbols were never part of by
// design (confirmed live with analysis-ts: GET /companies/profile 404s for both). Extending that
// endpoint's own contract is a real backend design decision analysis-ts is still scoping (ETF in
// particular needs a whole different response shape, not a mechanical UNION) — merging the two
// smaller universes in HERE instead, from endpoints that already exist and already serve this
// app's own dedicated preferred-stocks/ETF pages, is the fast path while that's pending:
// - GET /stocks/preferred-stocks (usePreferredStockList.ts's own source; TWSE-listed only per
//   analysis-ts, 28 entries confirmed live — no pagination, one call).
// - POST /etf-screener with no filters (useEtfScreener.ts's own source; 331 entries confirmed
//   live, paginated at a 200 server-side max — 2 calls).
// Revisit once analysis-ts actually ships a unified GET /companies — this three-way client-side
// merge can then collapse back to the single /stocks call it started as.
//
// Deliberately its own composable, NOT a replacement for useStocks.ts's useStockUniverse/Stock —
// that type carries price/per/pbr/dividendYield/volume/marketCapB (used by the dashboard
// watchlist and other list views), none of which these endpoints expose. Widening
// useStockUniverse itself to this data would silently null out every one of those fields for
// the companies the current mock list doesn't have real quotes for either — a separate,
// pre-existing gap (the watchlist/list views are still mock-backed) that isn't what was reported
// or asked for here. This composable only ever needs to answer "does a code/name exist, and what
// does it map to" for the search bar's own navigate-to-/stock/{code} purpose.
export function useCompanyIndex() {
  const config = useRuntimeConfig()

  async function fetchCommonStocks(): Promise<CompanyIndexEntry[]> {
    const PAGE_LIMIT = 1000
    const entries: CompanyIndexEntry[] = []
    let offset = 0
    let total = Infinity
    while (offset < total) {
      const response = await $fetch<StocksCollectionResponse>('/stocks', {
        baseURL: config.public.apiBase,
        query: { limit: PAGE_LIMIT, offset }
      })
      total = response.count
      if (!response.entries.length) break
      entries.push(...response.entries.map(entry => ({ code: entry.symbol, name: entry.name, kind: 'common' as const })))
      offset += response.entries.length
    }
    return entries
  }

  async function fetchPreferredStocks(): Promise<CompanyIndexEntry[]> {
    const response = await $fetch<PreferredStocksResponse>('/stocks/preferred-stocks', {
      baseURL: config.public.apiBase
    })
    return response.entries.map(entry => ({ code: entry.symbol, name: entry.name, kind: 'preferred' as const }))
  }

  async function fetchEtfs(): Promise<CompanyIndexEntry[]> {
    // Server-side max confirmed live: 200 (a 201+ pageSize 400s), unrelated to the 20 this app's
    // own etf-zone.vue uses for its own paginated browsing — this is a one-off full-list fetch,
    // not that page's own screener state.
    const PAGE_SIZE = 200
    const entries: CompanyIndexEntry[] = []
    let page = 1
    let totalPages = 1
    while (page <= totalPages) {
      const response = await $fetch<EtfScreenerListResponse>('/etf-screener', {
        baseURL: config.public.apiBase,
        method: 'POST',
        // Real bug caught live while verifying this — `columns: []` 400s ("\"filters\" or
        // \"columns\" must have at least one item"), unlike GET /stocks above which happily
        // takes no query at all for "everything." symbol/shortName come back regardless of
        // which columns are requested (see EtfScreenerRow's own always-present fields in
        // useEtfScreener.ts), so this just asks for one cheap, always-available field to
        // satisfy the non-empty requirement without it actually mattering which one.
        body: { columns: [{ field: 'aum' }], page, pageSize: PAGE_SIZE }
      })
      totalPages = response.totalPages
      entries.push(...response.results.map(entry => ({ code: entry.symbol, name: entry.shortName, kind: 'etf' as const })))
      page += 1
    }
    return entries
  }

  return useAsyncData<CompanyIndexEntry[]>(
    'company-index',
    async () => {
      // Independent, unrelated data sources — a failure in one (e.g. sitca-ts down for ETFs)
      // shouldn't blank out the other two, which is what a plain sequential await chain or
      // Promise.all would do. allSettled degrades to "just the sources that actually answered."
      const results = await Promise.allSettled([fetchCommonStocks(), fetchPreferredStocks(), fetchEtfs()])
      const entries: CompanyIndexEntry[] = []
      for (const result of results) {
        if (result.status === 'fulfilled') entries.push(...result.value)
        else if (import.meta.dev) console.warn('[company-index] one source failed', result.reason)
      }
      return entries
    },
    // Whole-market list, effectively static within a session — same "fetch once, reuse
    // everywhere" treatment useFilterSchema.ts's own getCachedData gives the filter catalog.
    { default: () => [], getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key] }
  )
}
