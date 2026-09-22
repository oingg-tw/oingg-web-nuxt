import type { ScreenerFieldValue } from '~/composables/screener/useFilterSearch'

// ONE field, and the name is now wider than the job. This composable was built for
// StockDividendStabilityCard.vue's four tiles（dividendYield.EOD / dividendPayoutRatio.TTM /
// consecutiveDividendYears.FY / shareholderYield.TTM, deliberately four different cadences because
// each metric is defined on its own）. That card is gone — the document-first rewrite replaced the
// metric-card grids with prose and tables — and the only consumer left,
// StockDividendYieldPercentileCard.vue, reads dividendYield.EOD alone.
//
// The other three were still being fetched on every stock page load and thrown away（trimmed
// 2026-09-22）. Restoring one is a one-word edit if a surface ever wants it again.
//
// The name stays useDividendStabilitySnapshot rather than churning its one import site; what it
// does — a current-value snapshot via POST /screener/values — is unchanged.
export const DIVIDEND_STABILITY_FIELDS = ['dividendYield.EOD'] as const

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
    // Client-only fetch on a cache miss — see useStockBadges.ts's own identical guard for why.
    if (import.meta.server) return
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
