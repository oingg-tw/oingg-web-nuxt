import type { ScreenerFieldValue } from '~/composables/screener/useFilterSearch'

interface ScreenerValuesResponse {
  count: number
  results: { symbol: string; name: string; values: Record<string, ScreenerFieldValue | null> }[]
}

const REQUEST_TIMEOUT_MS = 15_000

// Same POST /screener/values per-symbol lookup useStockHealthCheck.ts already established for
// the dashboard's 個股健檢 card, parameterized by an arbitrary field list instead of a fixed
// HEALTH_CHECK_FIELDS constant — StockGuruBadgeCard.vue calls this with only the guru badges
// that have a real fieldId (see guru-badges.ts), so the categories with no real methodology yet
// never fire a request for a field that doesn't exist.
export function useGuruBadgeScores(symbol: Ref<string | undefined>, fieldIds: string[]) {
  const config = useRuntimeConfig()
  const cache = useState<Record<string, Record<string, ScreenerFieldValue | null> | null>>('guru-badge-scores-cache', () => ({}))
  const data = ref<Record<string, ScreenerFieldValue | null> | null>(null)
  const pending = ref(false)

  async function load() {
    const targetSymbol = symbol.value
    if (!targetSymbol || !fieldIds.length) {
      data.value = null
      return
    }
    if (targetSymbol in cache.value) {
      data.value = cache.value[targetSymbol] ?? null
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
      cache.value[targetSymbol] = values
      data.value = values
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[guru-badge-scores] POST ${config.public.apiBase}/screener/values unavailable (${reason})`)
      }
      cache.value[targetSymbol] = null
      data.value = null
    } finally {
      pending.value = false
    }
  }

  watch(symbol, load, { immediate: true })

  return { data, pending }
}
