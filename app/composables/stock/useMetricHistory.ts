export type MetricCode = 'eps' | 'peRatio' | 'pbRatio'
export type MetricBasis = 'TTM' | 'Q'

export interface MetricHistoryEntry {
  fiscalYear: number
  fiscalQuarter: number
  value: number | null
  // e.g. 'insufficient_history' — not enough trailing quarters yet to compute this point, not
  // an error. A null value here means a real gap in the chart (ECharts leaves it un-connected
  // by default), never something to interpolate or zero-fill.
  nullReason: string | null
  knowledgeDate: string
  knowledgeDateIsFallback: boolean
}

interface MetricHistoryResponse {
  symbol: string
  metricCode: MetricCode
  basis: MetricBasis
  entries: MetricHistoryEntry[]
}

// bff-ts's GET /stocks/:symbol/metric-history (confirmed live 2026-09-07, proxying
// analysis-ts's own endpoint — see StockMetricHistoryChart.vue's own comment for which
// metricCode/basis pairs are real). Symbol is a PATH param here, not a query param, matching
// this app's existing financial-statement/capital-stock-history convention — NOT
// /companies/metric-history?symbol=..., an earlier assumption corrected once bff-ts actually
// built the passthrough. Confirmed live: basis isn't fixed per metricCode the way this app
// happens to use it — eps accepts both TTM and Q, only peRatio/pbRatio are basis-locked (TTM-
// only / Q-only respectively) — an invalid pairing 400s with analysis-ts's own descriptive
// message rather than a swallowed 502, though every call site here only ever passes a valid,
// hardcoded pair so this should never actually trigger in practice.
//
// Backfilled for 2330 only as of this date; any other symbol currently comes back with an
// empty `entries` array (not an error) — the chart component's own empty state covers that
// uniformly alongside a genuine fetch failure, since this app can't tell "not backfilled yet"
// apart from "temporarily unreachable" and shouldn't fabricate a distinction either.
//
// Client-only/own-cache, same reasoning as useFinancialStatement.ts: no SSR benefit, and this
// needs to re-fetch whenever the caller's lookback-window tab (limit) changes.
export function useMetricHistory(
  symbol: Ref<string | undefined>,
  metricCode: Ref<MetricCode>,
  basis: Ref<MetricBasis>,
  limit: Ref<number>
) {
  const config = useRuntimeConfig()
  const cache = useState<Record<string, MetricHistoryEntry[] | null>>('metric-history-cache', () => ({}))
  const data = ref<MetricHistoryEntry[] | null>(null)
  const pending = ref(false)
  // Same duplicate-in-flight guard as useFinancialStatement.ts — this composable is called
  // once per chart card, each with its own watch({immediate:true}), so a fast prop change
  // (e.g. tab click right after mount) can otherwise overlap two requests for what becomes
  // the same eventual key.
  let inFlightKey: string | null = null

  async function load() {
    const targetSymbol = symbol.value
    if (!targetSymbol) {
      data.value = null
      return
    }
    const key = `${targetSymbol}-${metricCode.value}-${basis.value}-${limit.value}`
    if (key in cache.value) {
      data.value = cache.value[key]!
      return
    }
    if (inFlightKey === key) return
    inFlightKey = key
    pending.value = true
    try {
      const result = await $fetch<MetricHistoryResponse>(`/stocks/${targetSymbol}/metric-history`, {
        baseURL: config.public.apiBase,
        retry: 0,
        query: { metricCode: metricCode.value, basis: basis.value, limit: limit.value }
      })
      cache.value[key] = result.entries
      data.value = result.entries
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[metric-history] GET ${config.public.apiBase}/stocks/${targetSymbol}/metric-history?metricCode=${metricCode.value} unavailable (${reason})`)
      }
      cache.value[key] = null
      data.value = null
    } finally {
      inFlightKey = null
      pending.value = false
    }
  }

  watch([symbol, metricCode, basis, limit], load, { immediate: true })

  return { data, pending }
}
