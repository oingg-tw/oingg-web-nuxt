export interface CompanyIndexEntry {
  code: string
  name: string
}

interface StocksCollectionResponse {
  count: number
  limit: number
  offset: number
  entries: { symbol: string; name: string }[]
}

// Real bug fixed 2026-09-11 (reported live: "searchbar有些證券代碼找不到") — the searchbar used to
// match against useStocks.ts's own MOCK_STOCK_UNIVERSE (a hardcoded ~20-large-cap fallback list,
// since GET /api/stocks itself 404'd) — meaning the vast majority of the ~2650 real listed
// companies were simply never in the searchable set at all, not a coverage gap so much as a
// missing data source entirely. bff-ts shipped GET /stocks (commit db32ce0, a pure pass-through
// of analysis-ts's own GET /companies) specifically for this — a lightweight {symbol, name} index
// across the whole market, paginated (limit 1-1000, default 200; no upper bound on offset).
//
// Deliberately its own composable, NOT a replacement for useStocks.ts's useStockUniverse/Stock —
// that type carries price/per/pbr/dividendYield/volume/marketCapB (used by the dashboard
// watchlist and other list views), none of which GET /stocks/GET /companies expose. Widening
// useStockUniverse itself to this endpoint would silently null out every one of those fields for
// ~2630 companies the current mock list doesn't have real quotes for either — a separate,
// pre-existing gap (the watchlist/list views are still mock-backed) that isn't what was reported
// or asked for here. This composable only ever needs to answer "does a code/name exist, and what
// does it map to" for the search bar's own navigate-to-/stock/{code} purpose.
export function useCompanyIndex() {
  const config = useRuntimeConfig()

  return useAsyncData<CompanyIndexEntry[]>(
    'company-index',
    async () => {
      const PAGE_LIMIT = 1000
      const entries: CompanyIndexEntry[] = []
      let offset = 0
      let total = Infinity
      try {
        while (offset < total) {
          const response = await $fetch<StocksCollectionResponse>('/stocks', {
            baseURL: config.public.apiBase,
            query: { limit: PAGE_LIMIT, offset }
          })
          total = response.count
          if (!response.entries.length) break
          entries.push(...response.entries.map(entry => ({ code: entry.symbol, name: entry.name })))
          offset += response.entries.length
        }
        return entries
      } catch (error) {
        if (import.meta.dev) {
          const reason = error instanceof Error ? error.message : String(error)
          console.warn(`[company-index] GET ${config.public.apiBase}/stocks unavailable (${reason})`)
        }
        return entries
      }
    },
    // Whole-market list, effectively static within a session — same "fetch once, reuse
    // everywhere" treatment useFilterSchema.ts's own getCachedData gives the filter catalog.
    { default: () => [], getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key] }
  )
}
