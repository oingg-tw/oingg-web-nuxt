export interface FilterCriterion {
  field: string
  min: number | null
  max: number | null
  exclude: boolean
}

export interface ScreenerResultColumn {
  field: string
  metricName: string
  fieldName: string
}

export interface ScreenerResultRow {
  symbol: string
  // Keyed by the same `field` string as ScreenerResultColumn.field; values come back as
  // strings (the BFF avoids floats on the wire), null when the company has no data for it.
  values: Record<string, string | null>
}

// Confirmed contract (oingg-bff-ts API reference): POST {apiBase}/screener with
// { filters: FilterCriterion[] } -> { count, columns: ScreenerResultColumn[], results:
// ScreenerResultRow[] }. Requires a Firebase ID token. The returned columns are whatever
// the signed-in user last saved via PUT /screener/columns (see useScreenerColumns) — the
// filter request body itself has no say over which columns come back, so the screener
// page saves the column selection before every search.
export function useFilterSearch() {
  const config = useRuntimeConfig()
  // The reactive, reliably-synced auth state (kept up to date via the compat SDK's
  // onAuthStateChanged in firebase.client.ts) — not useFirebaseAuth()'s modular `auth`
  // instance, whose own `currentUser` lives in a separate app registry and can lag right
  // after a fresh sign-in.
  const currentUser = useCurrentUser()

  const results = useState<ScreenerResultRow[]>('filter-search-results', () => [])
  const resultColumns = useState<ScreenerResultColumn[]>('filter-search-columns', () => [])
  const loading = ref(false)
  const searched = ref(false)

  async function search(filters: FilterCriterion[]) {
    if (!currentUser.value) {
      ElMessage.warning('請先登入後再使用選股篩選')
      return
    }

    loading.value = true
    searched.value = true
    try {
      const token = await currentUser.value.getIdToken()
      const response = await $fetch<{ count: number; columns: ScreenerResultColumn[]; results: ScreenerResultRow[] }>(
        '/screener',
        {
          baseURL: config.public.apiBase,
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: { filters }
        }
      )
      results.value = response.results
      resultColumns.value = response.columns
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[filter] POST ${config.public.apiBase}/screener failed (${reason})`)
      }
      results.value = []
    } finally {
      loading.value = false
    }
  }

  return { results, resultColumns, loading, searched, search }
}
