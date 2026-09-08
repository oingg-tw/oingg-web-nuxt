export interface ForeignShareholdingEntry {
  symbol: string
  tradeDate: string
  name: string
  isinCode: string
  issuedShares: number
  availableShares: number
  sharesHeld: number
  availableInvestPercent: number
  sharesHeldPercent: number
  foreignLimitPercent: number
  chinaLimitPercent: number
  changeReason: string | null
  lastReportDate: string | null
}

interface ForeignShareholdingHistoryResponse {
  symbol: string
  entries: ForeignShareholdingEntry[]
}

// bff-ts's GET /stocks/:symbol/foreign-shareholding-history (confirmed live 2026-09-08, commit
// af4b3cf), proxying analysis-ts's own endpoint over twse-ts's export.foreign_shareholding table.
// Only backfilled for 2330 as a one-time historical load (2021-09-07 to 2026-09-07) — NOT a
// regular full-market schedule (the old export.foreign_holding top-20-ranking table this
// replaces was dropped entirely for being too narrow a scope). Every other symbol returns
// {symbol, entries: []} with HTTP 200, not 404 — StockForeignShareholdingChart.vue treats an
// empty array as "尚未提供", not an error state.
//
// Two contract quirks this composable has to correct for, both confirmed directly by bff-ts
// and deliberately different from every other history endpoint on this page:
// - entries come back NEWEST-to-OLDEST (dupont-history/metric-history/etc are all oldest-to-
//   newest) — reversed here so the chart component gets the same left-to-right convention as
//   its siblings without needing its own special case.
// - `limit` defaults to only 250 rows if omitted (not the full history) and accepts up to 1500
//   — always requested at 1500 here so a single fetch covers the entire ~4-year 2330 backfill;
//   there's no `total`/`hasMore` field to page against even if more were needed.
export function useForeignShareholdingHistory(symbol: Ref<string | undefined>) {
  const config = useRuntimeConfig()
  const cache = useState<Record<string, ForeignShareholdingEntry[] | null>>('foreign-shareholding-history-cache', () => ({}))
  const data = ref<ForeignShareholdingEntry[] | null>(null)
  const pending = ref(false)
  let inFlightKey: string | null = null

  async function load() {
    const targetSymbol = symbol.value
    if (!targetSymbol) {
      data.value = null
      return
    }
    if (targetSymbol in cache.value) {
      data.value = cache.value[targetSymbol] ?? null
      return
    }
    if (inFlightKey === targetSymbol) return
    inFlightKey = targetSymbol
    pending.value = true
    try {
      const result = await $fetch<ForeignShareholdingHistoryResponse>(`/stocks/${targetSymbol}/foreign-shareholding-history`, {
        baseURL: config.public.apiBase,
        retry: 0,
        query: { limit: 1500 }
      })
      // Reverse: response is newest-to-oldest, this app's charts all read oldest-to-newest.
      const entries = [...result.entries].reverse()
      cache.value[targetSymbol] = entries
      data.value = entries
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[foreign-shareholding-history] GET ${config.public.apiBase}/stocks/${targetSymbol}/foreign-shareholding-history unavailable (${reason})`)
      }
      cache.value[targetSymbol] = null
      data.value = null
    } finally {
      inFlightKey = null
      pending.value = false
    }
  }

  watch(symbol, load, { immediate: true })

  return { data, pending }
}
