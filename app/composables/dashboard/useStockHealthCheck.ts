import type { ScreenerFieldValue, ScreenerResultColumn } from '~/composables/screener/useFilterSearch'

// Confirmed live with bff-ts 2026-09-02: POST /screener/values — a guest-usable (no auth,
// same as /market/*), single-round-trip lookup for one or more symbols' values across
// arbitrary screener fields. Reuses this app's existing ScreenerFieldValue/ScreenerResultColumn
// types (useFilterSearch.ts) since the per-field {value, asOfDate} shape is identical to the
// full screener's own /screener/presets/{id}/run response — this endpoint just isn't nested
// under a `screener`/`preset` wrapper the way that one is.
//
// Built for the dashboard's 個股健檢 card (conductor's suggestion 2026-09-02): guru scores
// (Piotroski F-Score, Altman Z-Score) only exist as per-company lookups, not a cross-market
// ranking, so a search-driven card is the only way to surface them without a new backend
// ranking endpoint. bff-ts flagged that guru-score coverage is currently sparse (their own
// test: only 台積電 had data in a 50-symbol sample) — expect null for most symbols, not a bug.
export const HEALTH_CHECK_FIELDS = [
  'piotroskiFScore.score',
  'altmanZScore.zScore',
  'per.peRatio',
  'pbr.pbRatio',
  'dividendYield.dividendYieldPct'
] as const

export interface StockHealthCheckRow {
  symbol: string
  name: string
  values: Record<string, ScreenerFieldValue | null>
}

interface ScreenerValuesResponse {
  count: number
  columns: ScreenerResultColumn[]
  results: StockHealthCheckRow[]
}

const REQUEST_TIMEOUT_MS = 15_000

export function useStockHealthCheck() {
  const config = useRuntimeConfig()

  const data = ref<StockHealthCheckRow | null>(null)
  const pending = ref(false)
  const notFound = ref(false)

  async function lookup(symbol: string) {
    pending.value = true
    notFound.value = false
    data.value = null
    try {
      const response = await $fetch<ScreenerValuesResponse>('/screener/values', {
        baseURL: config.public.apiBase,
        method: 'POST',
        body: { symbols: [symbol], columns: HEALTH_CHECK_FIELDS.map(field => ({ field })) },
        timeout: REQUEST_TIMEOUT_MS
      })
      const row = response.results[0]
      if (row) {
        data.value = row
      } else {
        notFound.value = true
      }
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[stock-health-check] POST ${config.public.apiBase}/screener/values unavailable (${reason})`)
      }
      notFound.value = true
    } finally {
      pending.value = false
    }
  }

  function reset() {
    data.value = null
    notFound.value = false
  }

  return { data, pending, notFound, lookup, reset }
}
