import type { Stock } from '~/composables/useStocks'

export interface FilterCriterion {
  field: string
  min: number | null
  max: number | null
  exclude: boolean
}

// Assumed contract: POST {apiBase}/api/screener with { filters: FilterCriterion[] } ->
// Stock[]. The response shape hasn't been decided yet, so this falls back to the current
// stock universe (real or mock, whichever useStockUniverse already resolved) if the
// endpoint isn't reachable — keeps the results table demoable ahead of the real backend.
export function useFilterSearch() {
  const config = useRuntimeConfig()
  const { universe } = useStocks()

  const results = useState<Stock[]>('filter-search-results', () => [])
  const loading = ref(false)
  const searched = ref(false)

  async function search(filters: FilterCriterion[]) {
    loading.value = true
    searched.value = true
    try {
      results.value = await $fetch<Stock[]>('/api/screener', {
        baseURL: config.public.apiBase,
        method: 'POST',
        body: { filters }
      })
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(
          `[filter] POST ${config.public.apiBase}/api/screener unavailable (${reason}), showing the stock universe instead`
        )
      }
      results.value = universe.value
    } finally {
      loading.value = false
    }
  }

  return { results, loading, searched, search }
}
