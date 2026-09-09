export interface MetricsHistoryPoint {
  value: number | null
  nullReason: string | null
  knowledgeDate: string
  knowledgeDateIsFallback: boolean
}

export interface MetricsHistoryEntry {
  fiscalYear: number
  fiscalQuarter: number
  // A metricCode with zero backfilled data for this specific period comes back as bare JSON
  // `null` for that key (not an object, not a missing key) — confirmed by bff-ts 2026-09-10
  // after a real 500 (commit 91e2bca: their own normalization code read `.value` off it without
  // a null check). Every read site here already uses `?.value` optional chaining, which safely
  // short-circuits to `undefined` on a null entry — this type just makes that explicit instead
  // of silently relying on `unknown`-shaped leniency.
  values: Record<string, MetricsHistoryPoint | null>
}

export type MetricsHistoryBasis = 'Q' | 'TTM'

interface MetricsHistoryResponse {
  symbol: string
  metricCodes: string[]
  basis: MetricsHistoryBasis
  total: number
  hasMore: boolean
  entries: MetricsHistoryEntry[]
}

// bff-ts's GET /stocks/:symbol/metrics-history (confirmed live 2026-09-09, commit b5167a3) —
// a genuinely DIFFERENT shape from useMetricHistory.ts's own single-metric metric-history:
// each entry carries a `values` object keyed by metricCode (not one bare `value`), since this
// endpoint fetches several metricCodes together in one request/response instead of one call
// per metric. Originally built for the growth-decomposition card family (EPS 成長分解/淨值成長
// 分解 — basis Q only, analysis-ts 400s "TTM" for that metric set). Basis parameterized 2026-09-09
// once the dividend-quality card family needed the SAME multi-metric endpoint but for a TTM-only
// metric set (dividendPayoutRatio/dividendCoverageRatio/buybackYield — confirmed live these
// reject "Q") — each metricCode set here is basis-locked on analysis-ts's own side, so every
// call site still only ever passes one fixed basis, this composable just no longer hardcodes
// which one. limit defaults 20/max 40. Only 2330 has data as of this date for most of these
// metricCode sets (analysis-ts's own backfill note) — this composable doesn't special-case
// sparse data, the chart component's own empty/sparse-state handling covers it the same way
// every other early-backfill card here already does.
type CachedHistory = { entries: MetricsHistoryEntry[]; total: number } | null

// Same cross-instance in-flight dedupe reasoning as useMetricHistory.ts — each card's own
// distinct metricCodes+basis combination mainly guards against a fast lookback-window tab click
// re-firing the same in-flight request twice, not cross-card sharing (the key includes both the
// joined metricCodes string and basis, so different cards never collide).
const inFlight = new Map<string, Promise<CachedHistory>>()

export function useMetricsHistory(symbol: Ref<string | undefined>, metricCodes: Ref<string[]>, basis: Ref<MetricsHistoryBasis>, limit: Ref<number>) {
  const config = useRuntimeConfig()
  const cache = useState<Record<string, CachedHistory>>('metrics-history-cache', () => ({}))
  const data = ref<MetricsHistoryEntry[] | null>(null)
  const total = ref<number | null>(null)
  const pending = ref(false)

  function keyFor(targetSymbol: string, codes: string[], targetBasis: MetricsHistoryBasis, targetLimit: number): string {
    return `${targetSymbol}-${codes.join(',')}-${targetBasis}-${targetLimit}`
  }

  async function fetchHistory(targetSymbol: string, codes: string[], targetBasis: MetricsHistoryBasis, targetLimit: number, key: string): Promise<CachedHistory> {
    try {
      const result = await $fetch<MetricsHistoryResponse>(`/stocks/${targetSymbol}/metrics-history`, {
        baseURL: config.public.apiBase,
        retry: 0,
        query: { metricCodes: codes.join(','), basis: targetBasis, limit: targetLimit }
      })
      return { entries: result.entries, total: result.total }
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[metrics-history] GET ${config.public.apiBase}/stocks/${targetSymbol}/metrics-history unavailable (${reason})`)
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
      total.value = null
      return
    }
    const codes = metricCodes.value
    const targetBasis = basis.value
    const targetLimit = limit.value
    const key = keyFor(targetSymbol, codes, targetBasis, targetLimit)
    let cached: CachedHistory
    if (key in cache.value) {
      cached = cache.value[key] ?? null
    } else {
      pending.value = true
      let request = inFlight.get(key)
      if (!request) {
        request = fetchHistory(targetSymbol, codes, targetBasis, targetLimit, key)
        inFlight.set(key, request)
      }
      cached = await request
      cache.value[key] = cached
    }
    // "Latest wins" — same guard as useMetricHistory.ts's own load(), a slower response for a
    // key the caller has since moved on from (fast tab click) must not overwrite newer state.
    const currentKey = symbol.value ? keyFor(symbol.value, metricCodes.value, basis.value, limit.value) : null
    if (currentKey !== key) return
    pending.value = false
    data.value = cached?.entries ?? null
    total.value = cached?.total ?? null
  }

  watch([symbol, metricCodes, basis, limit], load, { immediate: true })

  return { data, pending, total }
}
