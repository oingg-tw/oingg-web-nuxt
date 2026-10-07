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
  entries: { symbol: string; name: string | null }[]
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

// 搜尋列的全市場代號／名稱索引（2026-09-11，「searchbar有些證券代碼找不到」：之前只對一份約 20 檔的寫死清單比對）。
// GET /stocks（bff-ts db32ce0，analysis-ts GET /companies 的直通；分頁 limit 1–1000）只涵蓋 twse-ts／tpex-ts 的 company_profile，
// ETF 與特別股不在裡面（analysis-ts 確認 GET /companies/profile 對兩者都 404），所以同日把這兩個小宇宙在這裡併進來（「searchbar
// 要可以搜到 特別股 + ETF」）：GET /stocks/preferred-stocks（usePreferredStockList 的來源，28 筆、不分頁）與無條件的 POST
// /etf-screener（useEtfScreener 的來源，331 筆、每頁上限 200，兩次呼叫）。analysis-ts 若做出統一的 GET /companies，這個三路合併
// 可以退回單一呼叫。這裡只回答「這個代號／名稱存不存在、對到哪裡」，給搜尋列導向 /stock/{code} 用。
export function useCompanyIndex() {

  async function fetchCommonStocks(): Promise<CompanyIndexEntry[]> {
    const PAGE_LIMIT = 1000
    const entries: CompanyIndexEntry[] = []
    let offset = 0
    let total = Infinity
    while (offset < total) {
      const response = await $fetch<StocksCollectionResponse>('/stocks', {
        baseURL: BFF_BASE,
        query: { limit: PAGE_LIMIT, offset }
      })
      total = response.count
      if (!response.entries.length) break
      // name 可能是 null（bff-ts f750e92）。用代號頂上：搜尋會對 name 呼叫 toLowerCase()，一筆 null 就讓整個搜尋壞掉
      entries.push(...response.entries.map(entry => ({ code: entry.symbol, name: entry.name ?? entry.symbol, kind: 'common' as const })))
      offset += response.entries.length
    }
    return entries
  }

  async function fetchPreferredStocks(): Promise<CompanyIndexEntry[]> {
    const response = await $fetch<PreferredStocksResponse>('/stocks/preferred-stocks', {
      baseURL: BFF_BASE
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
        baseURL: BFF_BASE,
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
    //
    // Client-only (server: false + lazy, the dashboard's own lazy-fetch pattern) since 2026-09-19:
    // every consumer is a client-side interaction — the search bar (useStockSearch), the watchlist
    // name lookups, and useStocks() (which StockSummaryCard/useStockDetailSummary call on every
    // stock page). Fetching it during SSR cost ~6 upstream requests per page render AND
    // serialized the whole ~3,000-entry index into every page's payload; nothing a crawler reads
    // ever came from it.
    { server: false, lazy: true, default: () => [], getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key] }
  )
}
