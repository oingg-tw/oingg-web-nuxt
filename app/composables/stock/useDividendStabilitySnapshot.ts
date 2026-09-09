import type { ScreenerFieldValue } from '~/composables/screener/useFilterSearch'

// The 3 fields behind StockDividendStabilityCard.vue's own 3 tiles — deliberately 3 DIFFERENT
// basis/cadences (EOD/TTM/FY, per each metric's own definition in analysis-ts's
// domainPitMetrics/dividend), which is exactly why this is a snapshot lookup (current value
// only) rather than a history chart: forcing 3 mismatched periodicities onto one time axis is
// the same mistake already made and reverted once this session on the share-capital card (see
// StockShareCapitalChart.vue's own history — that one was walked back per direct correction).
export const DIVIDEND_STABILITY_FIELDS = ['dividendYield.EOD', 'dividendPayoutRatio.TTM', 'consecutiveDividendYears.FY'] as const

interface ScreenerValuesResponse {
  count: number
  columns: { field: string; metricName: string; fieldName: string; unit: string | null }[]
  results: { symbol: string; name: string; values: Record<string, ScreenerFieldValue | null> }[]
}

interface DividendStabilityCacheEntry {
  values: Record<string, ScreenerFieldValue | null>
  units: Record<string, string | null>
}

const REQUEST_TIMEOUT_MS = 15_000

// Same POST /screener/values per-symbol snapshot lookup useGuruBadgeScores.ts/
// useStockHealthCheck.ts already established (confirmed live 2026-09-09 that
// dividendYield.EOD/dividendPayoutRatio.TTM/consecutiveDividendYears.FY all resolve through it
// in one round trip despite their different bases) — a dedicated composable rather than reusing
// useGuruBadgeScores directly since that name is specifically about the guru-badge feature, even
// though its underlying shape is generic; this card's own field list is fixed (not caller-
// parameterized) since StockDividendStabilityCard.vue is its only consumer.
export function useDividendStabilitySnapshot(symbol: Ref<string | undefined>) {
  const config = useRuntimeConfig()
  const cache = useState<Record<string, DividendStabilityCacheEntry | null>>('dividend-stability-cache', () => ({}))
  const data = ref<Record<string, ScreenerFieldValue | null> | null>(null)
  const units = ref<Record<string, string | null>>({})
  const pending = ref(false)

  async function load() {
    const targetSymbol = symbol.value
    if (!targetSymbol) {
      data.value = null
      units.value = {}
      return
    }
    if (targetSymbol in cache.value) {
      data.value = cache.value[targetSymbol]?.values ?? null
      units.value = cache.value[targetSymbol]?.units ?? {}
      return
    }
    pending.value = true
    try {
      const response = await $fetch<ScreenerValuesResponse>('/screener/values', {
        baseURL: config.public.apiBase,
        method: 'POST',
        body: { symbols: [targetSymbol], columns: DIVIDEND_STABILITY_FIELDS.map(field => ({ field })) },
        timeout: REQUEST_TIMEOUT_MS
      })
      const values = response.results[0]?.values ?? null
      const fieldUnits = Object.fromEntries(response.columns.map(column => [column.field, column.unit]))
      cache.value[targetSymbol] = { values: values ?? {}, units: fieldUnits }
      data.value = values
      units.value = fieldUnits
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[dividend-stability] POST ${config.public.apiBase}/screener/values unavailable (${reason})`)
      }
      cache.value[targetSymbol] = null
      data.value = null
      units.value = {}
    } finally {
      pending.value = false
    }
  }

  watch(symbol, load, { immediate: true })

  return { data, units, pending }
}
