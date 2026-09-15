export interface DailyPriceHistoryEntry {
  tradeDate: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface DailyPriceHistoryResponse {
  symbol: string
  entries: DailyPriceHistoryEntry[]
}

// bff-ts's GET /stocks/:symbol/daily-price-history (confirmed live 2026-09-10, commit a03d9a8) —
// genuinely daily-resolution OHLCV, a different data source from useMetricHistory's own
// 'stockPrice' metricCode (that one is a Q-timeframe quarter-end SNAPSHOT used by
// StockValuationRiverChart.vue, not a real daily series). Built for StockPriceHistoryChart.vue's
// own 市場評價 tab card ("個股瀏覽 市場評價 幫我加上 股價歷史卡片"). `limit` is a day-count, not
// a period count — confirmed live capped at 2000 by the backend's own validator (a "limit must
// be an integer between 1 and 2000" 400 above that). 2330 itself has ~1424 trading days on
// record back to 2020-11-02 as of this date; other symbols may hit the market-wide 2022Q1-ish
// data floor sooner (see project_market_wide_2022q1_financial_data_floor memory) — this
// composable doesn't special-case that, the chart just renders however many entries come back
// and its own x-axis naturally starts wherever the real data starts.
type CachedHistory = DailyPriceHistoryEntry[] | null

const inFlight = new Map<string, Promise<CachedHistory>>()

export function useDailyPriceHistory(symbol: Ref<string | undefined>, limit: Ref<number>) {
  const config = useRuntimeConfig()
  const cache = useState<Record<string, CachedHistory>>('daily-price-history-cache', () => ({}))
  const data = ref<DailyPriceHistoryEntry[] | null>(null)
  const pending = ref(false)

  function keyFor(targetSymbol: string, targetLimit: number): string {
    return `${targetSymbol}-${targetLimit}`
  }

  async function fetchHistory(targetSymbol: string, targetLimit: number, key: string): Promise<CachedHistory> {
    try {
      const result = await $fetch<DailyPriceHistoryResponse>(`/stocks/${targetSymbol}/daily-price-history`, {
        baseURL: config.public.apiBase,
        retry: 0,
        query: { limit: targetLimit }
      })
      return result.entries
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[daily-price-history] GET ${config.public.apiBase}/stocks/${targetSymbol}/daily-price-history unavailable (${reason})`)
      }
      return null
    } finally {
      inFlight.delete(key)
    }
  }

  async function load() {
    const targetSymbol = symbol.value
    if (!targetSymbol) {
      data.value = null
      return
    }
    const targetLimit = limit.value
    const key = keyFor(targetSymbol, targetLimit)
    let cached: CachedHistory
    if (key in cache.value) {
      cached = cache.value[key] ?? null
    } else {
      pending.value = true
      let request = inFlight.get(key)
      if (!request) {
        request = fetchHistory(targetSymbol, targetLimit, key)
        inFlight.set(key, request)
      }
      cached = await request
      cache.value[key] = cached
    }
    const currentKey = symbol.value ? keyFor(symbol.value, limit.value) : null
    if (currentKey !== key) return
    pending.value = false
    data.value = cached
  }

  watch([symbol, limit], load, { immediate: true })

  return { data, pending }
}
