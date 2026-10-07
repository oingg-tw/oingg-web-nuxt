export interface EtfNumericFilter {
  field: string
  kind: 'numeric'
  min: number | null
  max: number | null
}

export interface EtfCategoricalFilter {
  field: string
  kind: 'categorical'
  values: string[]
}

export type EtfFilterState = EtfNumericFilter | EtfCategoricalFilter

export interface EtfScreenerRow {
  symbol: string
  fundName: string
  shortName: string
  issuerName: string
  category: string
  values: Record<string, string | number | boolean | null>
}

interface EtfScreenerResponse {
  count: number
  page: number
  pageSize: number
  totalPages: number
  results: EtfScreenerRow[]
}

const PAGE_SIZE = 20

// bff-ts's POST /etf-screener (confirmed live 2026-09-07, proxying sitca-ts's own
// export.etf_basic_info) — a genuinely simpler contract than the stock screener's own split
// preset+run architecture (useScreenerPresets.ts/useScreenerTabs.ts): one combined POST takes
// filters AND columns together, no separate persisted-preset resource on the backend at all
// (confirmed — bff-ts's own description only mentioned this endpoint, GET /etf-screener/filters,
// and GET /market/etf-ranking; no /etf-screener/presets or /etf-screener/column-presets).
// So filters/columns/sort/page live in plain client-side `ref`s here, not backend-synced state
// — there's nothing to sync TO yet. Revisit as a real persisted-preset composable only if/when
// bff-ts actually ships that resource.
//
// Request shape confirmed live by direct probing (not guessed): numeric filters are
// `{ field, min, max }` (either may be null — an open-ended range), categorical filters are
// `{ field, values: string[] }` — both match the `{ field }`-object convention already used
// everywhere else in this app's screener stack (see useScreenerColumnPresets.ts's own comment).
// `columns` is always `{ field }[]`, never bare strings (confirmed: the endpoint 400s on bare
// strings with "expected object, received string"). Response is FLAT (`count`/`page`/`pageSize`/
// `totalPages`/`results`), not nested under a `screener` key the way the stock screener's own
// preset-run response is — there's no `preset` object here since there's no preset resource.
// 曾有一份排除清單把 return1y／expenseRatio 擋在挑選器外，兩個欄位 2026-09-07 都證實正確後清空，2026-10-08 連同
// 恆為空的陣列一起刪（經過見 project_etf_screener_data_scale_bug.md）。

export function useEtfScreener() {

  const filters = ref<EtfFilterState[]>([])
  // Overwritten immediately by etf-zone.vue's own immediate watcher on the active column
  // preset — kept in sync with useEtfColumnPresets.ts's own DEFAULT_COLUMNS anyway so this
  // composable's default isn't stale if it's ever used standalone without that page.
  const columns = ref<string[]>(['aum', 'return1y', 'expenseRatio', 'nav', 'market', 'assetClass'])
  const sortField = ref<string | null>(null)
  const sortOrder = ref<'asc' | 'desc'>('desc')
  const page = ref(1)

  const rows = ref<EtfScreenerRow[]>([])
  const count = ref(0)
  const totalPages = ref(0)
  const pending = ref(false)
  // Separate from `pending` per direct request ("按下排序或是載入table有延遲要加上loader") —
  // `pending` alone doesn't distinguish an infinite-scroll append (rows already on screen,
  // shouldn't be covered by a full-table spinner) from a sort/search/filter-switch replace
  // (rows already on screen too, but about to be swapped out — needs its own loading feedback,
  // which EtfResultTable.vue's old `pending && !rows.length` check silently skipped once any
  // rows already existed).
  const appending = ref(false)
  const searched = ref(false)
  const errorMessage = ref<string | null>(null)

  function activeFilterPayload(): Record<string, unknown>[] {
    // The return annotation is load-bearing: without it TypeScript infers a UNION OF ARRAY TYPES
    // from the two branches（numeric rows vs categorical rows）, and flatMap's own signature wants
    // `T | readonly T[]`, not `A[] | B[]`. Naming the element type collapses the union at the
    // right place rather than casting the result afterwards.
    return filters.value.flatMap((filter): Record<string, unknown>[] => {
      if (filter.kind === 'numeric') {
        if (filter.min === null && filter.max === null) return []
        return [{ field: filter.field, min: filter.min, max: filter.max }]
      }
      if (filter.values.length === 0) return []
      return [{ field: filter.field, values: filter.values }]
    })
  }

  // append=true is infinite-scroll's own "load the next page onto the bottom of what's already
  // shown" case (EtfResultTable.vue's IntersectionObserver sentinel calls loadMore()); every
  // other caller (a fresh search, a sort change) wants the usual replace-the-whole-list
  // behavior instead, so this stays a shared internal fetcher with a flag rather than two
  // near-duplicate copies of the same request/error handling.
  async function run(append: boolean) {
    pending.value = true
    appending.value = append
    if (!append) errorMessage.value = null
    try {
      const body: Record<string, unknown> = {
        columns: columns.value.map(field => ({ field })),
        page: page.value,
        pageSize: PAGE_SIZE
      }
      const activeFilters = activeFilterPayload()
      if (activeFilters.length) body.filters = activeFilters
      if (sortField.value) {
        body.sortField = sortField.value
        body.sortOrder = sortOrder.value
      }
      const result = await $fetch<EtfScreenerResponse>('/etf-screener', {
        baseURL: BFF_BASE,
        method: 'POST',
        retry: 0,
        body
      })
      rows.value = append ? [...rows.value, ...result.results] : result.results
      count.value = result.count
      totalPages.value = result.totalPages
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      errorMessage.value = reason
      if (import.meta.dev) console.warn(`[etf-screener] POST ${BFF_BASE}/etf-screener failed (${reason})`)
      if (!append) {
        rows.value = []
        count.value = 0
        totalPages.value = 0
      }
    } finally {
      pending.value = false
      appending.value = false
      searched.value = true
    }
  }

  function search() {
    page.value = 1
    return run(false)
  }

  // Infinite scroll (per direct request, replacing page-number pagination) — appends page+1
  // onto the existing rows instead of replacing them. Guards against firing past the last page
  // or piling up overlapping requests while one is already in flight (an IntersectionObserver
  // sentinel can re-trigger before `pending` flips back if not guarded here).
  function loadMore() {
    if (pending.value || page.value >= totalPages.value) return
    page.value += 1
    return run(true)
  }

  function setSort(field: string | null, order: 'asc' | 'desc') {
    sortField.value = field
    sortOrder.value = order
    page.value = 1
    return run(false)
  }

  function removeFilter(field: string) {
    filters.value = filters.value.filter(filter => filter.field !== field)
  }

  return {
    filters,
    columns,
    sortField,
    sortOrder,
    page,
    pageSize: PAGE_SIZE,
    rows,
    count,
    totalPages,
    pending,
    appending,
    searched,
    errorMessage,
    search,
    loadMore,
    setSort,
    removeFilter
  }
}
