import type { FilterCriterion, ScreenerResultColumn, ScreenerResultRow } from '~/composables/useFilterSearch'

export interface ScreenerPreset {
  id: number
  name: string
  filters: FilterCriterion[]
  createdAt?: string
  updatedAt?: string
}

export interface ScreenerRunResult {
  count: number
  columns: ScreenerResultColumn[]
  results: ScreenerResultRow[]
}

// Confirmed: POST /screener/presets responds with { preset: {...} } (not the { item }
// wrapper /watchlist uses) — checked against the running BFF. list() below assumes the
// matching { presets: [...] } plural for the same reason, and run() assumes the
// `{count, columns, results}` shape already confirmed for POST /screener; adjust either
// if they turn out to differ once actually exercised.
export function useScreenerPresets() {
  const config = useRuntimeConfig()
  const currentUser = useCurrentUser()

  async function authHeader() {
    if (!currentUser.value) return null
    const token = await currentUser.value.getIdToken()
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
        headers
      })
      return response.presets
    } catch (error) {
      warn('GET /screener/presets', error)
      return []
    }
  }

  async function create(name: string, filters: FilterCriterion[]): Promise<ScreenerPreset | null> {
    const headers = await authHeader()
    if (!headers) return null
    try {
      const response = await $fetch<{ preset: ScreenerPreset }>('/screener/presets', {
        baseURL: config.public.apiBase,
        method: 'POST',
        headers,
        body: { name, filters }
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
        body: patch
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
      await $fetch(`/screener/presets/${id}`, { baseURL: config.public.apiBase, method: 'DELETE', headers })
      return true
    } catch (error) {
      warn(`DELETE /screener/presets/${id}`, error)
      return false
    }
  }

  async function run(id: number): Promise<ScreenerRunResult | null> {
    const headers = await authHeader()
    if (!headers) return null
    try {
      return await $fetch<ScreenerRunResult>(`/screener/presets/${id}/run`, {
        baseURL: config.public.apiBase,
        headers
      })
    } catch (error) {
      warn(`GET /screener/presets/${id}/run`, error)
      return null
    }
  }

  return { list, create, update, remove, run }
}
