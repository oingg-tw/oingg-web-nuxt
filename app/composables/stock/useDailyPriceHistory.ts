export interface DailyPriceHistoryEntry {
  tradeDate: string
  open: number
  high: number
  low: number
  close: number
  // null ＝ 沒有資料，不是 0 股（bff-ts 359dc48：證交所無成交日可能是 NULL，例如 1538 2026-09-03；上櫃寫 0）。
  // 判斷那天有沒有成交看 close === null，不看 volume。
  volume: number | null
}

interface DailyPriceHistoryResponse {
  symbol: string
  entries: DailyPriceHistoryEntry[]
  // 這檔最早的交易日（bff-ts 2026-09-16 應我們要求加的），跟這次請求的 `limit` 無關。
  earliestAvailableTradeDate: string | null
}

type CachedHistory = { entries: DailyPriceHistoryEntry[]; earliestAvailableTradeDate: string | null } | null

const inFlight = new Map<string, Promise<CachedHistory>>()

// bff-ts 的 GET /stocks/:symbol/daily-price-history（2026-09-10 實測，a03d9a8）——真正的日線 OHLCV，跟 useMetricsHistory 的
// 'stockPrice'（季末快照，StockValuationRiverChart 用）是不同的資料來源。`limit` 是天數不是期數，後端上限 2000（超過回 400）。
// 2330 當時約 1424 個交易日、回到 2020-11-02；其他代號可能更早碰到市場級的資料地板——這裡不特別處理，圖表有幾筆畫幾筆。
// 2026-09-19 起走本站的快取直通 /api/bff，伺服器快取 15 分鐘。
export function useDailyPriceHistory(symbol: Ref<string | undefined>, limit: Ref<number>) {
  const cache = useState<Record<string, CachedHistory>>('daily-price-history-cache', () => ({}))
  const data = ref<DailyPriceHistoryEntry[] | null>(null)
  const pending = ref(false)

  function keyFor(targetSymbol: string, targetLimit: number): string {
    return `${targetSymbol}-${targetLimit}`
  }

  async function fetchHistory(targetSymbol: string, targetLimit: number, key: string): Promise<CachedHistory> {
    try {
      const result = await $fetch<DailyPriceHistoryResponse>(`/stocks/${targetSymbol}/daily-price-history`, {
        baseURL: '/api/bff',
        retry: 0,
        query: { limit: targetLimit }
      })
      return { entries: result.entries, earliestAvailableTradeDate: result.earliestAvailableTradeDate ?? null }
    } catch (error) {
      devWarn('daily-price-history', `GET /api/bff/stocks/${targetSymbol}/daily-price-history unavailable`, error)
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
      // Client-only fetch on a cache miss — see useStockBadges.ts's own identical guard for why.
      if (import.meta.server) return
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
    data.value = cached?.entries ?? null
  }

  watch([symbol, limit], load, { immediate: true })

  return { data, pending }
}
