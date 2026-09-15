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

// 'Q_ANN' briefly existed 2026-09-14 for metricCodes with no plain 'Q' field (single quarter's
// figure annualized ×4), then analysis-ts removed it entirely across every metric the same day
// (commit 054ae0b, cost-saving move) — back down to just 'Q'/'TTM'/'FY', no annualized-quarter
// option exists anywhere anymore. Every caller that briefly used 'Q_ANN' (StockEvMultiplesCard.vue,
// StockCashConversionCycleChart.vue, StockDebtCoverageChart.vue's netDebtToEbitda) reverted to
// 'TTM' the same day — those metrics have no 'Q' either, so TTM is their only option now.
// 'FY' added 2026-09-14 (real type gap fix, not new backend capability — StockChowderNumberChart.vue/
// StockSueChart.vue and now StockDividendGrowthRateCard.vue already pass 'FY' at runtime
// successfully for metrics whose only allowedPeriodTypes entry IS 'FY', e.g. chowderNumber/
// dividendGrowthRateNy; the type here just never included it, a pre-existing typecheck error this
// closes rather than adding a 3rd instance of).
//
// Renamed Basis→Timeframe 2026-09-14 per direct request ("可以不要再用basis? 後端用語現在叫做
// timeframe才可識別") — this app's own internal vocabulary only; bff-ts's own PUBLIC query param
// key toward this app is still literally `basis` for this endpoint (confirmed via its own Zod
// schema, `basis: z.string()` on GET /stocks/:symbol/metrics-history) — bff-ts deliberately kept
// its own external contract stable when IT renamed its internal token→basis→timeframe vocabulary
// (see useMetricHistory.ts's own comment for that history), so the wire query key below stays
// `basis:` even though every local identifier in this file is now `timeframe`.
export type MetricsHistoryTimeframe = 'Q' | 'TTM' | 'FY'

interface MetricsHistoryResponse {
  symbol: string
  metricCodes: string[]
  basis: MetricsHistoryTimeframe
  total: number
  hasMore: boolean
  entries: MetricsHistoryEntry[]
}

// bff-ts's GET /stocks/:symbol/metrics-history (confirmed live 2026-09-09, commit b5167a3) —
// a genuinely DIFFERENT shape from useMetricHistory.ts's own single-metric metric-history:
// each entry carries a `values` object keyed by metricCode (not one bare `value`), since this
// endpoint fetches several metricCodes together in one request/response instead of one call
// per metric. Originally built for the growth-decomposition card family (EPS 成長分解/淨值成長
// 分解 — Q timeframe only, analysis-ts 400s "TTM" for that metric set). Timeframe parameterized
// 2026-09-09 once the dividend-quality card family needed the SAME multi-metric endpoint but for
// a TTM-only metric set (dividendPayoutRatio/dividendCoverageRatio/buybackYield — confirmed live
// these reject "Q") — each metricCode set here is timeframe-locked on analysis-ts's own side, so
// every call site still only ever passes one fixed timeframe, this composable just no longer
// hardcodes which one. limit defaults 20/max 40. Only 2330 has data as of this date for most of these
// metricCode sets (analysis-ts's own backfill note) — this composable doesn't special-case
// sparse data, the chart component's own empty/sparse-state handling covers it the same way
// every other early-backfill card here already does.
type CachedHistory = { entries: MetricsHistoryEntry[]; total: number } | null

// Same cross-instance in-flight dedupe reasoning as useMetricHistory.ts — each card's own
// distinct metricCodes+timeframe combination mainly guards against a fast lookback-window tab
// click re-firing the same in-flight request twice, not cross-card sharing (the key includes both
// the joined metricCodes string and timeframe, so different cards never collide).
const inFlight = new Map<string, Promise<CachedHistory>>()

// bff-ts caps this endpoint at 10 metricCodes per request ("metricCodes 最多 10 個") — a real
// 400 discovered live 2026-09-13 once StockHistoricalStatisticsTable.vue started requesting
// every available indicator by default (60+ codes) instead of a small fixed set every existing
// caller happened to stay under. Chunked transparently here (parallel requests, merged by
// period) so every caller — the existing small ones and this new large one — gets one combined
// result and never has to know the limit exists.
const MAX_METRIC_CODES_PER_REQUEST = 10

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

export function useMetricsHistory(symbol: Ref<string | undefined>, metricCodes: Ref<string[]>, timeframe: Ref<MetricsHistoryTimeframe>, limit: Ref<number>) {
  const config = useRuntimeConfig()
  const cache = useState<Record<string, CachedHistory>>('metrics-history-cache', () => ({}))
  const data = ref<MetricsHistoryEntry[] | null>(null)
  const total = ref<number | null>(null)
  const pending = ref(false)

  function keyFor(targetSymbol: string, codes: string[], targetTimeframe: MetricsHistoryTimeframe, targetLimit: number): string {
    return `${targetSymbol}-${codes.join(',')}-${targetTimeframe}-${targetLimit}`
  }

  async function fetchOneChunk(targetSymbol: string, codes: string[], targetTimeframe: MetricsHistoryTimeframe, targetLimit: number): Promise<CachedHistory> {
    try {
      const result = await $fetch<MetricsHistoryResponse>(`/stocks/${targetSymbol}/metrics-history`, {
        baseURL: config.public.apiBase,
        retry: 0,
        // Wire query key stays `basis` — see this file's own top comment.
        query: { metricCodes: codes.join(','), basis: targetTimeframe, limit: targetLimit }
      })
      return { entries: result.entries, total: result.total }
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[metrics-history] GET ${config.public.apiBase}/stocks/${targetSymbol}/metrics-history unavailable (${reason})`)
      }
      return null
    }
  }

  // Merges each chunk's own entries by fiscalYear/fiscalQuarter — chunks share the same symbol/
  // timeframe/limit so their period sets line up, but merge by key rather than assuming identical
  // array order/length regardless (a chunk that 400s independently must not misalign the rest).
  async function fetchHistory(targetSymbol: string, codes: string[], targetTimeframe: MetricsHistoryTimeframe, targetLimit: number, key: string): Promise<CachedHistory> {
    try {
      const codeChunks = chunk(codes, MAX_METRIC_CODES_PER_REQUEST)
      const results = await Promise.all(codeChunks.map(codeChunk => fetchOneChunk(targetSymbol, codeChunk, targetTimeframe, targetLimit)))
      const successful = results.filter((result): result is Exclude<CachedHistory, null> => result !== null)
      if (successful.length === 0) return null
      const byPeriod = new Map<string, MetricsHistoryEntry>()
      for (const result of successful) {
        for (const entry of result.entries) {
          const periodKey = `${entry.fiscalYear}-${entry.fiscalQuarter}`
          const existing = byPeriod.get(periodKey)
          if (existing) Object.assign(existing.values, entry.values)
          else byPeriod.set(periodKey, { fiscalYear: entry.fiscalYear, fiscalQuarter: entry.fiscalQuarter, values: { ...entry.values } })
        }
      }
      const entries = [...byPeriod.values()].sort((a, b) => a.fiscalYear - b.fiscalYear || a.fiscalQuarter - b.fiscalQuarter)
      return { entries, total: Math.max(...successful.map(result => result.total)) }
    } finally {
      inFlight.delete(key)
    }
  }

  async function load() {
    const targetSymbol = symbol.value
    const codes = metricCodes.value
    if (!targetSymbol || codes.length === 0) {
      data.value = null
      total.value = null
      return
    }
    const targetTimeframe = timeframe.value
    const targetLimit = limit.value
    const key = keyFor(targetSymbol, codes, targetTimeframe, targetLimit)
    let cached: CachedHistory
    if (key in cache.value) {
      cached = cache.value[key] ?? null
    } else {
      pending.value = true
      let request = inFlight.get(key)
      if (!request) {
        request = fetchHistory(targetSymbol, codes, targetTimeframe, targetLimit, key)
        inFlight.set(key, request)
      }
      cached = await request
      cache.value[key] = cached
    }
    // "Latest wins" — same guard as useMetricHistory.ts's own load(), a slower response for a
    // key the caller has since moved on from (fast tab click) must not overwrite newer state.
    const currentKey = symbol.value ? keyFor(symbol.value, metricCodes.value, timeframe.value, limit.value) : null
    if (currentKey !== key) return
    pending.value = false
    data.value = cached?.entries ?? null
    total.value = cached?.total ?? null
  }

  watch([symbol, metricCodes, timeframe, limit], load, { immediate: true })

  return { data, pending, total }
}
