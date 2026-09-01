import type { FilterCriterion } from '~/composables/screener/useFilterSearch'
import type { ScreenerPreset } from '~/composables/screener/useScreenerPresets'

// Officially-maintained strategies (e.g. "巴菲特護城河") a user can copy into their own
// screener presets — distinct from ScreenerPreset, which is always user-owned. Confirmed
// live against GET /screener/templates: PENDING entries (a strategy the product team has
// named but can't run yet — see pendingReason) come back with an empty `filters` array, so
// they're listed for visibility but never selectable.
export interface ScreenerTemplate {
  id: string
  name: string
  category: string
  description: string
  tier: 'FREE' | 'PAID'
  status: 'AVAILABLE' | 'PENDING'
  pendingReason: string | null
  filters: FilterCriterion[]
  createdAt: string
  updatedAt: string
}

const TOKEN_TIMEOUT_MS = 10_000
const REQUEST_TIMEOUT_MS = 15_000

// Same shape/reasoning as useScreenerPresets.ts's own describeError — kept as an
// independent copy rather than a shared import, matching useScreenerColumnPresets.ts.
function describeError(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('data' in error)) return null
  const data = (error as { data?: unknown }).data
  if (!data || typeof data !== 'object' || !('error' in data)) return null
  const inner = (data as { error?: unknown }).error
  if (!inner || typeof inner !== 'object' || !('message' in inner)) return null
  const message = (inner as { message?: unknown }).message
  return typeof message === 'string' ? message : null
}

export function useScreenerTemplates() {
  const config = useRuntimeConfig()
  const currentUser = useCurrentUser()

  const lastErrorMessage = ref<string | null>(null)

  function warn(action: string, error: unknown) {
    lastErrorMessage.value = describeError(error)
    if (!import.meta.dev) return
    const reason = error instanceof Error ? error.message : String(error)
    console.warn(`[screener-templates] ${action} failed (${reason})`)
  }

  // No auth header — GET /screener/templates is public (confirmed live: it answers with
  // no Authorization header at all), so browsing official strategies works signed-out too.
  async function list(): Promise<ScreenerTemplate[]> {
    try {
      const response = await $fetch<{ templates: ScreenerTemplate[] }>('/screener/templates', {
        baseURL: config.public.apiBase,
        timeout: REQUEST_TIMEOUT_MS
      })
      return response.templates
    } catch (error) {
      warn('GET /screener/templates', error)
      return []
    }
  }

  // Copies a template's filters into a brand-new ScreenerPreset owned by the caller —
  // requires login, unlike list() above.
  async function apply(id: string): Promise<ScreenerPreset | null> {
    if (!currentUser.value) return null
    try {
      const token = await withTimeout(currentUser.value.getIdToken(), TOKEN_TIMEOUT_MS, '登入驗證逾時')
      const response = await $fetch<{ preset: ScreenerPreset }>(`/screener/templates/${id}/apply`, {
        baseURL: config.public.apiBase,
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        timeout: REQUEST_TIMEOUT_MS
      })
      return response.preset
    } catch (error) {
      warn(`POST /screener/templates/${id}/apply`, error)
      return null
    }
  }

  return { list, apply, lastErrorMessage }
}
