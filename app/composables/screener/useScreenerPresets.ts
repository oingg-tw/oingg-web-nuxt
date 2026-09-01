import type { FilterCriterion, ScreenerResultColumn, ScreenerResultRow } from '~/composables/screener/useFilterSearch'

// Ids across every user-owned screener resource (this preset, column-presets) are UUID
// strings, not auto-increment integers — bff-ts commit c40fa87 switched all of
// WatchlistItem/ColumnPreset/ScreenerPreset/Holding/StockTransaction over to UUIDs
// deliberately (a sequential integer leaks row count/creation order and is easy to
// enumerate). Never Number(id) these — that silently produces NaN.
export interface ScreenerPreset {
  id: string
  name: string
  filters: FilterCriterion[]
  // Present on the preset object as returned by GET .../run (not seen on a bare create
  // response, presumably because it's unset until a preset has actually been run once) —
  // mirrors the run response's own top-level columnPresetId after that point.
  lastColumnPresetId?: string | null
  createdAt?: string
  updatedAt?: string
}

// Confirmed shape of GET /screener/presets/{id}/run — nested under `screener`, not flat
// as first assumed. `run()` below unwraps this into a flatter ScreenerRunResult so
// callers don't need to know about the nesting.
// Server-side pagination — page is 1-indexed. Confirmed live against POST /screener: pageSize
// defaults to 50 when omitted, results/count/totalPages all come back scoped to that one
// page (count is the page's own row count, not the overall total — see ScreenerPagination
// below for the field that actually is).
export interface ScreenerPaginationParams {
  page?: number
  pageSize?: number
}

// Confirmed live with bff-ts 2026-09-01: full-result-set sort (applied server-side before
// pagination, not just whatever page happens to be loaded), given as query params on this
// GET endpoint. sortField must be "symbol" or one of this run's own columns/values field
// keys — "name" is NOT supported (company name is stitched in per-request from a separate
// analysis-ts endpoint, not part of their queryable screener data — kept as a client-only,
// page-local sort in OrganismResultTable.vue instead). Both fields are required together;
// the API 400s if only one is given, hence bundling them as one object here rather than two
// separate optional params.
export interface ScreenerSortParams {
  field: string
  order: 'asc' | 'desc'
}

interface ScreenerPagination {
  page: number
  pageSize: number
  totalPages: number
}

interface ScreenerRunApiResponse {
  preset: ScreenerPreset
  screener: {
    count: number
    columns: ScreenerResultColumn[]
    results: ScreenerResultRow[]
  } & ScreenerPagination
  // Which column-preset the run actually displayed — resolved server-side from (in
  // order) the columnPresetId passed in, this preset's last-viewed column-preset, the
  // user's own isDefault column-preset, or null for the system's built-in fallback
  // columns (price/PER/PBR/dividend yield). Passing columnPresetId back in on the next
  // run for this same tab is also how the server remembers it as that preset's view.
  columnPresetId: string | null
}

export interface ScreenerRunResult extends ScreenerPagination {
  count: number
  columns: ScreenerResultColumn[]
  results: ScreenerResultRow[]
  columnPresetId: string | null
  preset: ScreenerPreset
}

// Confirmed against the live BFF (GET http://localhost:4000/api-docs, and an actual
// captured response for the run endpoint): POST /screener/presets responds with
// { preset: {...} } (not the { item } wrapper /watchlist uses) — list() below assumes
// the matching { presets: [...] } plural for the same reason (the docs' prose doesn't
// spell out every response body, only descriptions).
// A hung Firebase token refresh or a request that never settles would otherwise leave
// any `await` chain built on these — including a search button's loading state, reset in
// a `finally` — stuck forever, since a `finally` only runs once its `try` actually
// settles. These bound every request so that always eventually happens.
const TOKEN_TIMEOUT_MS = 10_000
const REQUEST_TIMEOUT_MS = 15_000

// The BFF's error responses are shaped { error: { message: "..." } } (confirmed against
// the live backend — e.g. a 409 Conflict renaming a preset to a name that's already taken
// comes back with the actual reason here, not just a bare status code). Pulled out
// separately from `warn` below so it degrades safely to null on anything that isn't that
// exact shape (a network failure, a timeout, an HTML error page from a proxy, etc.).
function describeError(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('data' in error)) return null
  const data = (error as { data?: unknown }).data
  if (!data || typeof data !== 'object' || !('error' in data)) return null
  const inner = (data as { error?: unknown }).error
  if (!inner || typeof inner !== 'object' || !('message' in inner)) return null
  const message = (inner as { message?: unknown }).message
  return typeof message === 'string' ? message : null
}

export function useScreenerPresets() {
  const config = useRuntimeConfig()
  const currentUser = useCurrentUser()

  // Set by warn() below on every failed request, read by callers right after an await that
  // came back falsy/empty — lets them show the BFF's actual reason (e.g. "此名稱已被使用")
  // instead of only a generic "失敗了" with no explanation of why, while still falling back
  // to their own contextually-worded message when the backend didn't give one (a network
  // error, a timeout — describeError returns null for those, not a made-up explanation).
  const lastErrorMessage = ref<string | null>(null)

  async function authHeader() {
    if (!currentUser.value) return null
    const token = await withTimeout(currentUser.value.getIdToken(), TOKEN_TIMEOUT_MS, '登入驗證逾時')
    return { Authorization: `Bearer ${token}` }
  }

  function warn(action: string, error: unknown) {
    lastErrorMessage.value = describeError(error)
    if (!import.meta.dev) return
    const reason = error instanceof Error ? error.message : String(error)
    console.warn(`[screener-presets] ${action} failed (${reason})`)
  }

  async function list(): Promise<ScreenerPreset[]> {
    const headers = await authHeader()
    if (!headers) return []
    try {
      const response = await $fetch<{ presets: ScreenerPreset[] }>('/screener/presets', {
        baseURL: config.public.apiBase,
        headers,
        timeout: REQUEST_TIMEOUT_MS
      })
      return response.presets
    } catch (error) {
      warn('GET /screener/presets', error)
      return []
    }
  }

  async function create(filters: FilterCriterion[]): Promise<ScreenerPreset | null> {
    const headers = await authHeader()
    if (!headers) return null
    try {
      const response = await $fetch<{ preset: ScreenerPreset }>('/screener/presets', {
        baseURL: config.public.apiBase,
        method: 'POST',
        headers,
        body: { filters },
        timeout: REQUEST_TIMEOUT_MS
      })
      return response.preset
    } catch (error) {
      warn('POST /screener/presets', error)
      return null
    }
  }

  async function update(id: string, patch: { name?: string; filters?: FilterCriterion[] }): Promise<ScreenerPreset | null> {
    const headers = await authHeader()
    if (!headers) return null
    try {
      const response = await $fetch<{ preset: ScreenerPreset }>(`/screener/presets/${id}`, {
        baseURL: config.public.apiBase,
        method: 'PATCH',
        headers,
        body: patch,
        timeout: REQUEST_TIMEOUT_MS
      })
      return response.preset
    } catch (error) {
      warn(`PATCH /screener/presets/${id}`, error)
      return null
    }
  }

  async function remove(id: string): Promise<boolean> {
    const headers = await authHeader()
    if (!headers) return false
    try {
      await $fetch(`/screener/presets/${id}`, {
        baseURL: config.public.apiBase,
        method: 'DELETE',
        headers,
        timeout: REQUEST_TIMEOUT_MS
      })
      return true
    } catch (error) {
      warn(`DELETE /screener/presets/${id}`, error)
      return false
    }
  }

  async function run(
    id: string,
    columnPresetId?: string,
    pagination?: ScreenerPaginationParams,
    sort?: ScreenerSortParams
  ): Promise<ScreenerRunResult | null> {
    const headers = await authHeader()
    if (!headers) return null
    try {
      const response = await $fetch<ScreenerRunApiResponse>(`/screener/presets/${id}/run`, {
        baseURL: config.public.apiBase,
        headers,
        query: {
          ...(columnPresetId !== undefined ? { columnPresetId } : {}),
          ...pagination,
          ...(sort ? { sortField: sort.field, sortOrder: sort.order } : {})
        },
        timeout: REQUEST_TIMEOUT_MS
      })
      return {
        count: response.screener.count,
        columns: response.screener.columns,
        results: response.screener.results,
        columnPresetId: response.columnPresetId,
        preset: response.preset,
        page: response.screener.page,
        pageSize: response.screener.pageSize,
        totalPages: response.screener.totalPages
      }
    } catch (error) {
      warn(`GET /screener/presets/${id}/run`, error)
      return null
    }
  }

  return { list, create, update, remove, run, lastErrorMessage }
}
