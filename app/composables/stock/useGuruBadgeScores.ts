import type { ScreenerFieldValue } from '~/composables/screener/useFilterSearch'

interface ScreenerValuesResponse {
  count: number
  columns: { field: string; metricName: string; fieldName: string; unit: string | null }[]
  results: { symbol: string; name: string; values: Record<string, ScreenerFieldValue | null> }[]
}

interface GuruBadgeScoresCacheEntry {
  values: Record<string, ScreenerFieldValue | null>
  units: Record<string, string | null>
}

const REQUEST_TIMEOUT_MS = 15_000

// Same POST /screener/values per-symbol lookup useStockHealthCheck.ts already established for
// the dashboard's 個股健檢 card, parameterized by an arbitrary field list instead of a fixed
// HEALTH_CHECK_FIELDS constant — StockGuruBadgeCard.vue calls this with only the guru badges
// that have a real fieldId (see guru-badges.ts), so the categories with no real methodology yet
// never fire a request for a field that doesn't exist.
//
// Also returns each field's real `unit` from the response's own `columns` array (bff-ts shipped
// this live 2026-09-09 — every field now returns its real unit like "%"/"元"/"分" instead of
// null) — lets StockGuruBadgeCard.vue drop its own hardcoded UNIT_BY_BADGE_ID fallback dictionary
// that existed only because units used to come back null for every field (see
// project_screener_backend_outage memory).
export function useGuruBadgeScores(symbol: Ref<string | undefined>, fieldIds: string[]) {
  const config = useRuntimeConfig()
  const cache = useState<Record<string, GuruBadgeScoresCacheEntry | null>>('guru-badge-scores-cache', () => ({}))
  const data = ref<Record<string, ScreenerFieldValue | null> | null>(null)
  const units = ref<Record<string, string | null>>({})
  const pending = ref(false)

  async function load() {
    const targetSymbol = symbol.value
    if (!targetSymbol || !fieldIds.length) {
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
        body: { symbols: [targetSymbol], columns: fieldIds.map(field => ({ field })) },
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
        console.warn(`[guru-badge-scores] POST ${config.public.apiBase}/screener/values unavailable (${reason})`)
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
