// per/pbr/dividendYield widened to `number | null` 2026-09-14 alongside the real GET
// /stocks/{symbol} wiring in stock/[code].vue (see useStockSummary.ts's own comment) — that
// endpoint's own valuation section is independently nullable per symbol (not every company has a
// backfilled PER/PBR/dividendYield yet), and substituting 0 for a genuinely-missing value would
// render as a real, wrong number ("PER 0.00 倍") rather than the "尚未提供" this app shows
// everywhere else for missing data. formatStockValue() below renders null as '－'. price stays
// non-nullable — the detail page treats a quote response with no `price` section as "no usable
// quote for this symbol" and falls back to the not-found state entirely, rather than trying to
// render a priceless stock.
//
// change/changePercent/volume/marketCapB widened to `number | null` the same day, same root
// cause as the 404 above — bff-ts's real GET /stocks/{symbol} has no change/volume/marketCap data
// at all (only `price.close` and the valuation ratios), so a per-symbol page/card computes
// change/changePercent/volume itself from useDailyPriceHistory's own real daily OHLCV (see
// stock/[code].vue's and useWatchlistStocks.ts's own comments) — that derivation can legitimately
// come back with nothing (fewer than 2 days of history on record for a symbol), and marketCapB
// has no real backend source at all right now, always null until one exists. Same '－' placeholder
// rule as per/pbr/dividendYield above, not a fabricated 0.
export interface Stock {
  code: string
  name: string
  price: number
  change: number | null
  changePercent: number | null
  per: number | null
  pbr: number | null
  dividendYield: number | null
  volume: number | null
  marketCapB: number | null
}

export type StockColumnKey = Exclude<keyof Stock, 'code' | 'name'>

export interface StockColumnDef {
  key: StockColumnKey
  label: string
  unit: string
  default: boolean
}

// A results-table column for a metric outside the Stock type (e.g. picked from the
// /filters catalog) — StockTable renders these with a placeholder until a backend
// response shape exists that actually returns per-stock values for them.
export interface StockTableExtraColumn {
  key: string
  label: string
}

export const STOCK_COLUMNS: StockColumnDef[] = [
  { key: 'price', label: '股價', unit: '元', default: true },
  { key: 'change', label: '漲跌', unit: '元', default: true },
  { key: 'changePercent', label: '漲跌幅', unit: '%', default: true },
  { key: 'per', label: 'PER', unit: '倍', default: true },
  { key: 'pbr', label: 'PBR', unit: '倍', default: true },
  { key: 'dividendYield', label: '殖利率', unit: '%', default: false },
  { key: 'volume', label: '成交量', unit: '張', default: false },
  { key: 'marketCapB', label: '市值', unit: '億', default: false }
]

// Served from the backend once it exposes GET /api/stocks (see useStockUniverse); kept as the
// offline/dev fallback so the app still works before that endpoint exists or when it's unreachable.
const MOCK_STOCK_UNIVERSE: Stock[] = [
  { code: '2330', name: '台積電', price: 1015, change: 15, changePercent: 1.5, per: 23.1, pbr: 7.2, dividendYield: 1.6, volume: 28345, marketCapB: 263200 },
  { code: '2317', name: '鴻海', price: 198.5, change: -1.5, changePercent: -0.75, per: 12.4, pbr: 2.1, dividendYield: 3.8, volume: 41230, marketCapB: 27400 },
  { code: '2454', name: '聯發科', price: 1330, change: 25, changePercent: 1.92, per: 19.8, pbr: 5.6, dividendYield: 2.9, volume: 5320, marketCapB: 21200 },
  { code: '2412', name: '中華電', price: 128, change: 0.5, changePercent: 0.39, per: 25.6, pbr: 3.2, dividendYield: 4.5, volume: 8760, marketCapB: 9930 },
  { code: '2882', name: '國泰金', price: 62.3, change: -0.4, changePercent: -0.64, per: 11.2, pbr: 1.4, dividendYield: 4.1, volume: 22100, marketCapB: 9440 },
  { code: '2881', name: '富邦金', price: 88.6, change: 1.1, changePercent: 1.26, per: 10.5, pbr: 1.5, dividendYield: 3.9, volume: 15600, marketCapB: 8560 },
  { code: '2308', name: '台達電', price: 412, change: 6, changePercent: 1.48, per: 28.3, pbr: 6.8, dividendYield: 1.9, volume: 6540, marketCapB: 10680 },
  { code: '1301', name: '台塑', price: 52.4, change: -0.6, changePercent: -1.13, per: 32.1, pbr: 0.9, dividendYield: 2.3, volume: 9870, marketCapB: 4680 },
  { code: '2603', name: '長榮', price: 178, change: 4.5, changePercent: 2.59, per: 6.8, pbr: 1.6, dividendYield: 5.2, volume: 33400, marketCapB: 5640 },
  { code: '2609', name: '陽明', price: 94.2, change: -2.1, changePercent: -2.18, per: 5.4, pbr: 1.3, dividendYield: 6.1, volume: 27800, marketCapB: 2980 },
  { code: '3008', name: '大立光', price: 2260, change: 40, changePercent: 1.8, per: 21.5, pbr: 3.1, dividendYield: 2.6, volume: 620, marketCapB: 3030 },
  { code: '2002', name: '中鋼', price: 26.8, change: 0.1, changePercent: 0.37, per: 18.9, pbr: 0.8, dividendYield: 3.4, volume: 45200, marketCapB: 4160 },
  { code: '1216', name: '統一', price: 76.5, change: 0.5, changePercent: 0.66, per: 20.2, pbr: 2.7, dividendYield: 3.5, volume: 7340, marketCapB: 2400 },
  { code: '2886', name: '兆豐金', price: 41.2, change: -0.3, changePercent: -0.72, per: 12.8, pbr: 1.5, dividendYield: 5.5, volume: 19800, marketCapB: 5940 },
  { code: '2891', name: '中信金', price: 33.5, change: 0.4, changePercent: 1.21, per: 10.9, pbr: 1.3, dividendYield: 4.7, volume: 26300, marketCapB: 5240 },
  { code: '3711', name: '日月光投控', price: 138, change: 2.5, changePercent: 1.85, per: 16.7, pbr: 2.4, dividendYield: 3.1, volume: 11200, marketCapB: 7160 },
  { code: '2382', name: '廣達', price: 289, change: -4, changePercent: -1.36, per: 24.6, pbr: 8.9, dividendYield: 2.2, volume: 13400, marketCapB: 7600 },
  { code: '2303', name: '聯電', price: 51.9, change: 0.9, changePercent: 1.76, per: 14.3, pbr: 1.9, dividendYield: 3.6, volume: 38900, marketCapB: 6870 },
  { code: '1110', name: '東南水泥', price: 22.4, change: -0.15, changePercent: -0.66, per: 15.6, pbr: 0.7, dividendYield: 4.2, volume: 980, marketCapB: 89 }
]

export function useStockUniverse() {
  const config = useRuntimeConfig()

  return useAsyncData<Stock[]>(
    'stock-universe',
    async () => {
      try {
        return await $fetch<Stock[]>('/api/stocks', { baseURL: config.public.apiBase })
      } catch (error) {
        if (import.meta.dev) {
          const reason = error instanceof Error ? error.message : String(error)
          console.warn(
            `[stocks] GET ${config.public.apiBase}/api/stocks unavailable (${reason}), using mock data instead`
          )
        }
        return MOCK_STOCK_UNIVERSE
      }
    },
    { default: () => MOCK_STOCK_UNIVERSE }
  )
}

// Real placeholder added 2026-09-14 alongside per/pbr/dividendYield/marketCapB going nullable
// (see Stock's own comment) — '－' matches this app's established missing-data placeholder
// elsewhere (e.g. preferred-stocks/index.vue's own __placeholder cells) rather than rendering a
// fabricated 0.00.
export function formatStockValue(stock: Stock, key: StockColumnKey) {
  const value = stock[key]
  if (value === null) return '－'
  if (key === 'change' || key === 'changePercent') {
    const sign = value > 0 ? '+' : ''
    return `${sign}${value.toFixed(2)}`
  }
  if (key === 'volume' || key === 'marketCapB') {
    return value.toLocaleString('zh-TW')
  }
  return value.toFixed(2)
}

// Default seed is just 8 real, valid stock codes (the same 8 that used to lead
// MOCK_STOCK_UNIVERSE) — not the fabricated numbers that used to come attached to them. A brand
// new watchlist still starts with a few recognizable large-cap names instead of a blank table,
// but every number shown for them now comes from useWatchlistStocks' own real per-symbol fetch.
const DEFAULT_WATCHLIST_CODES = ['2330', '2317', '2454', '2412', '2882', '2881', '2308', '1301']

// Real bug fixed 2026-09-14 (mock-data survey) — `watchlist` used to store full Stock OBJECTS,
// every one of them either sourced from or falling back to MOCK_STOCK_UNIVERSE, so the whole
// table (including the default 8) showed fabricated price/PER/PBR/殖利率 forever, never updating.
// Now stores just CODES — the real per-symbol numbers are resolved reactively downstream by
// useWatchlistStocks.ts (watchlist.vue/DashboardWatchlistExDividendCard.vue's own concern), not
// captured once at add-time and left stale. addStock/removeStock operate on codes only now; a
// caller wanting the real Stock objects should call useWatchlistStocks(watchlistCodes) itself.
export function useStocks() {
  const { data: universe } = useStockUniverse()
  const { data: companies } = useCompanyIndex()

  const watchlistCodes = useState<string[]>('stock-watchlist-codes', () => [...DEFAULT_WATCHLIST_CODES])
  const visibleColumnKeys = useState<StockColumnKey[]>('stock-visible-columns', () =>
    STOCK_COLUMNS.filter(column => column.default).map(column => column.key)
  )

  const visibleColumns = computed(() =>
    STOCK_COLUMNS.filter(column => visibleColumnKeys.value.includes(column.key))
  )

  // Still backed by MOCK_STOCK_UNIVERSE (see useStockUniverse's own comment) — used only by
  // StockSearchBar's own legacy call sites that haven't migrated to useStockSearch()/
  // useCompanyIndex() yet. New code should prefer useStockSearch() instead, which searches the
  // real whole-market index (see that composable's own history).
  function searchUniverse(query: string) {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return []
    return universe.value
      .filter(stock => stock.code.startsWith(keyword) || stock.name.toLowerCase().includes(keyword))
      .sort((a, b) => a.code.localeCompare(b.code))
  }

  function addStock(code: string) {
    if (watchlistCodes.value.includes(code)) {
      ElMessage.warning('已在觀察清單中')
      return
    }
    const name = companies.value.find(company => company.code === code)?.name ?? code
    watchlistCodes.value = [...watchlistCodes.value, code]
    ElMessage.success(`已加入 ${name}`)
  }

  function removeStock(code: string) {
    watchlistCodes.value = watchlistCodes.value.filter(existing => existing !== code)
  }

  return {
    universe,
    watchlistCodes,
    columns: STOCK_COLUMNS,
    visibleColumnKeys,
    visibleColumns,
    searchUniverse,
    addStock,
    removeStock
  }
}
