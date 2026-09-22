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

// MOCK_STOCK_UNIVERSE itself is GONE as of 2026-09-22, with useStockUniverse() and
// searchUniverse() — the last of the 2026-09-14 mock-data survey's findings to be cleared. It was
// a ~20-company hardcoded list behind a fetch of `GET /api/stocks`, an endpoint that never existed
//（the real collection is `/stocks`）, so that call 404'd on every render and fell back to the
// fabrication. Both consumers had already moved off it — StockHealthCheckCard to useStockSearch on
// 2026-09-14, the watchlist to codes-only — leaving code a reader could still mistake for a live
// fallback. Zero readers confirmed before deleting: every remaining `searchUniverse` in the app is
// useStockSearch's own, which runs against the real market-wide company index.
//
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
  const { data: companies } = useCompanyIndex()

  const watchlistCodes = useState<string[]>('stock-watchlist-codes', () => [...DEFAULT_WATCHLIST_CODES])
  const visibleColumnKeys = useState<StockColumnKey[]>('stock-visible-columns', () =>
    STOCK_COLUMNS.filter(column => column.default).map(column => column.key)
  )

  const visibleColumns = computed(() =>
    STOCK_COLUMNS.filter(column => visibleColumnKeys.value.includes(column.key))
  )

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
    watchlistCodes,
    columns: STOCK_COLUMNS,
    visibleColumnKeys,
    visibleColumns,
    addStock,
    removeStock
  }
}
