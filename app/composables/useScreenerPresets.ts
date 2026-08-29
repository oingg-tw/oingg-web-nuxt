import type { FilterCriterion, ScreenerResultColumn, ScreenerResultRow } from '~/composables/useFilterSearch'

export interface ScreenerPreset {
  id: number
  name: string
  filters: FilterCriterion[]
  // Present on the preset object as returned by GET .../run (not seen on a bare create
  // response, presumably because it's unset until a preset has actually been run once) —
  // mirrors the run response's own top-level columnPresetId after that point.
  lastColumnPresetId?: number | null
  createdAt?: string
  updatedAt?: string
}

// Confirmed shape of GET /screener/presets/{id}/run — nested under `screener`, not flat
// as first assumed. `run()` below unwraps this into a flatter ScreenerRunResult so
// callers don't need to know about the nesting.
interface ScreenerRunApiResponse {
  preset: ScreenerPreset
  screener: {
    count: number
    columns: ScreenerResultColumn[]
    results: ScreenerResultRow[]
  }
  // Which column-preset the run actually displayed — resolved server-side from (in
  // order) the columnPresetId passed in, this preset's last-viewed column-preset, the
  // user's own isDefault column-preset, or null for the system's built-in fallback
  // columns (price/PER/PBR/dividend yield). Passing columnPresetId back in on the next
  // run for this same tab is also how the server remembers it as that preset's view.
  columnPresetId: number | null
}

export interface ScreenerRunResult {
  count: number
  columns: ScreenerResultColumn[]
  results: ScreenerResultRow[]
  columnPresetId: number | null
  preset: ScreenerPreset
}

// POST /screener response — flat (no `preset` wrapper, unlike the by-id run above), since
// this doesn't belong to any saved preset at all. Works signed-out (see below); a valid
// token instead of `undefined` there personalizes columnPresetId to the caller's own
// default column preset — unused by the guest screener tab, which never has one.
export interface AnonymousScreenerRunResult {
  count: number
  columns: ScreenerResultColumn[]
  results: ScreenerResultRow[]
  columnPresetId: number | null
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

export function useScreenerPresets() {
  const config = useRuntimeConfig()
  const currentUser = useCurrentUser()

  async function authHeader() {
    if (!currentUser.value) return null
    const token = await withTimeout(currentUser.value.getIdToken(), TOKEN_TIMEOUT_MS, '登入驗證逾時')
    return { Authorization: `Bearer ${token}` }
  }

  function warn(action: string, error: unknown) {
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

  async function update(id: number, patch: { name?: string; filters?: FilterCriterion[] }): Promise<ScreenerPreset | null> {
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

  async function remove(id: number): Promise<boolean> {
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

  async function run(id: number, columnPresetId?: number): Promise<ScreenerRunResult | null> {
    const headers = await authHeader()
    if (!headers) return null
    try {
      const response = await $fetch<ScreenerRunApiResponse>(`/screener/presets/${id}/run`, {
        baseURL: config.public.apiBase,
        headers,
        query: columnPresetId !== undefined ? { columnPresetId } : undefined,
        timeout: REQUEST_TIMEOUT_MS
      })
      return {
        count: response.screener.count,
        columns: response.screener.columns,
        results: response.screener.results,
        columnPresetId: response.columnPresetId,
        preset: response.preset
      }
    } catch (error) {
      warn(`GET /screener/presets/${id}/run`, error)
      return null
    }
  }

  // No auth header at all — POST /screener works signed-out (see the BFF route), and this
  // is only ever called from the guest screener tab, which has no user to attach one for.
  async function runAnonymous(filters: FilterCriterion[]): Promise<AnonymousScreenerRunResult | null> {
    try {
      return await $fetch<AnonymousScreenerRunResult>('/screener', {
        baseURL: config.public.apiBase,
        method: 'POST',
        body: { filters },
        timeout: REQUEST_TIMEOUT_MS
      })
    } catch (error) {
      warn('POST /screener', error)
      return null
    }
  }

  return { list, create, update, remove, run, runAnonymous }
}
