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
// Both fields that were ever excluded here are now confirmed good — see
// project_etf_screener_data_scale_bug.md for the full history. return1y was RE-CONFIRMED GOOD
// 2026-09-07 (sitca-ts re-pulled the live official page for 0050: 101.58% matches exactly, a
// genuine ~101% rolling-1yr compound during a real bull-market stretch, not a data bug).
// expenseRatio was excluded for the same reason (0050 showing 0.02% vs FundClear's 0.42%) until
// sitca-ts found and fixed the actual root cause 2026-09-07: a query-period reset bug (switching
// years silently narrowed the window to a single December) plus a pre-2022 parser miscounting
// columns and silently returning 0 — not a methodology difference. Re-verified live numbers
// (0050 0.22%, 006208 0.23%, 0056 0.57%, 00878 0.52%) are sane, restored below. Kept as an empty
// array (rather than deleted) since EtfFilterEditor.vue/EtfResultTable.vue both import it as the
// one place to exclude a field again if a future data-quality issue ever needs it.
export const ETF_UNRELIABLE_FIELDS: string[] = []

export function useEtfScreener() {
  const config = useRuntimeConfig()

  const filters = ref<EtfFilterState[]>([])
  // return1y restored to the defaults now that it's confirmed good (see ETF_UNRELIABLE_FIELDS's
  // own comment) — expenseRatio stays out, replaced with market/assetClass's own neighbors.
  const columns = ref<string[]>(['aum', 'return1y', 'nav', 'market', 'assetClass'])
  const sortField = ref<string | null>(null)
  const sortOrder = ref<'asc' | 'desc'>('desc')
  const page = ref(1)

  const rows = ref<EtfScreenerRow[]>([])
  const count = ref(0)
  const totalPages = ref(0)
  const pending = ref(false)
  const searched = ref(false)
  const errorMessage = ref<string | null>(null)

  function activeFilterPayload(): Record<string, unknown>[] {
    return filters.value.flatMap(filter => {
      if (filter.kind === 'numeric') {
        if (filter.min === null && filter.max === null) return []
        return [{ field: filter.field, min: filter.min, max: filter.max }]
      }
      if (filter.values.length === 0) return []
      return [{ field: filter.field, values: filter.values }]
    })
  }

  async function run() {
    pending.value = true
    errorMessage.value = null
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
        baseURL: config.public.apiBase,
        method: 'POST',
        retry: 0,
        body
      })
      rows.value = result.results
      count.value = result.count
      totalPages.value = result.totalPages
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      errorMessage.value = reason
      if (import.meta.dev) console.warn(`[etf-screener] POST ${config.public.apiBase}/etf-screener failed (${reason})`)
      rows.value = []
      count.value = 0
      totalPages.value = 0
    } finally {
      pending.value = false
      searched.value = true
    }
  }

  function search() {
    page.value = 1
    return run()
  }

  function goToPage(next: number) {
    page.value = next
    return run()
  }

  function setSort(field: string | null, order: 'asc' | 'desc') {
    sortField.value = field
    sortOrder.value = order
    page.value = 1
    return run()
  }

  function addFilter(field: EtfFilterState) {
    if (filters.value.some(existing => existing.field === field.field)) return
    filters.value.push(field)
  }

  function removeFilter(field: string) {
    filters.value = filters.value.filter(filter => filter.field !== field)
  }

  function resetFilters() {
    filters.value = []
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
    searched,
    errorMessage,
    search,
    goToPage,
    setSort,
    addFilter,
    removeFilter,
    resetFilters
  }
}
