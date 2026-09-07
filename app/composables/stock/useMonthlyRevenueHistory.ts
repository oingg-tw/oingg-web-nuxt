export interface MonthlyRevenueEntry {
  yearMonth: string
  reportDate: string
  industry: string
  // Bigint-serialized as strings (NT$ thousand) per bff-ts's own note — parse to Number before
  // charting, never treat as already-numeric.
  currentMonthRevenue: string
  lastYearSameMonthRevenue: string
  yoyChangePercent: number
  // Null only on the series' earliest entry (no prior month to compare against) — bff-ts
  // computes this themselves (analysis-ts's source data has no momChangePercent field at all).
  momChangePercent: number | null
  cumulativeRevenue: string
  cumulativeLastYearRevenue: string
  cumulativeChangePercent: number
  // The company's own filed revenue-variance explanation. A literal "無" string means the
  // company explicitly reported nothing unusual; real null means no disclosure at all — bff-ts
  // confirmed these are two distinct states, don't conflate them into one "no note" case.
  note: string | null
}

interface MonthlyRevenueHistoryResponse {
  symbol: string
  entries: MonthlyRevenueEntry[]
}

// bff-ts's GET /stocks/:symbol/monthly-revenue-history (confirmed live 2026-09-07, proxying
// analysis-ts's own GET /companies/monthly-revenue-history — a one-time manual backfill, not a
// daily-updating pipeline, so this won't grow new months or new symbols on its own). Only 2330
// is backfilled (60 months, 2021-08~2026-07) as of this date; every other symbol correctly
// returns an empty `entries` array (not a 404) — same "not backfilled yet" vs "temporarily
// unreachable" ambiguity this app already can't distinguish elsewhere, covered by the chart's
// own empty state.
//
// limit here is bff-ts's own 1-120 range (NOT the 1-40 range metric/roe/roa/dupont-history use)
// — omitting it returns everything. This composable always fetches the max (120) once and lets
// StockRevenueChart.vue's own 近5年/近10年 tabs slice the already-fetched array client-side,
// rather than refetching per tab like the quarterly history composables do — there's no `total`
// field on this endpoint to pre-disable a "近10年 would be identical" tab with, and at most 120
// months is a small enough payload that slicing beats a second round-trip.
export function useMonthlyRevenueHistory(symbol: Ref<string | undefined>) {
  const config = useRuntimeConfig()
  const cache = useState<Record<string, MonthlyRevenueEntry[] | null>>('monthly-revenue-history-cache', () => ({}))
  const data = ref<MonthlyRevenueEntry[] | null>(null)
  const pending = ref(false)
  let inFlightKey: string | null = null

  async function load() {
    const targetSymbol = symbol.value
    if (!targetSymbol) {
      data.value = null
      return
    }
    const key = targetSymbol
    if (key in cache.value) {
      data.value = cache.value[key]
      return
    }
    if (inFlightKey === key) return
    inFlightKey = key
    pending.value = true
    try {
      const result = await $fetch<MonthlyRevenueHistoryResponse>(`/stocks/${targetSymbol}/monthly-revenue-history`, {
        baseURL: config.public.apiBase,
        retry: 0,
        query: { limit: 120 }
      })
      cache.value[key] = result.entries
      data.value = result.entries
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[monthly-revenue-history] GET ${config.public.apiBase}/stocks/${targetSymbol}/monthly-revenue-history unavailable (${reason})`)
      }
      cache.value[key] = null
      data.value = null
    } finally {
      inFlightKey = null
      pending.value = false
    }
  }

  watch(symbol, load, { immediate: true })

  return { data, pending }
}
