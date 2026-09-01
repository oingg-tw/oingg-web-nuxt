export interface ScreenerColumnPresetField {
  field: string
}

// Officially-curated column sets (存股領息/價值投資/財務體質排雷/獲利品質拆解/成長型/技術面短線,
// synced from analysis-ts) a user can copy into their own column-preset — mirrors
// ScreenerTemplate in useScreenerTemplates.ts (filter presets' own equivalent), confirmed
// live with bff-ts 2026-09-01: no category/tier/status fields like filter templates have,
// just a flat list.
export interface ColumnPresetTemplate {
  key: string
  name: string
  description: string
  fieldKeys: string[]
}

// UUID, not an auto-increment integer — see the matching comment on ScreenerPreset in
// useScreenerPresets.ts (bff-ts commit c40fa87). Never Number(id) this.
export interface ScreenerColumnPreset {
  id: string
  name: string
  isDefault: boolean
  columns: ScreenerColumnPresetField[]
  createdAt?: string
  updatedAt?: string
}

// Confirmed against the live BFF (GET http://localhost:4000/api-docs): display columns
// are their own saved, named resource — /screener/column-presets — not a single global
// per-user slot as an earlier draft of the doc suggested. `field` is "<metricKey>.<fieldKey>"
// from GET /filters, plus one special case not in that catalog: "stock.price". `isDefault`
// is exclusive — setting it un-defaults whatever else was default for that user.
//
// Response wrapper keys ({columnPreset}/{columnPresets}) aren't shown in the API-docs
// prose (it only documents request bodies, not response schemas) — inferred from the
// already-confirmed {preset}/{presets} convention on the sibling /screener/presets
// endpoints. Adjust here if that turns out to differ once exercised.
// A hung Firebase token refresh or a request that never settles would otherwise leave
// any `await` chain built on these — including a search button's loading state, reset in
// a `finally` — stuck forever, since a `finally` only runs once its `try` actually
// settles. These bound every request so that always eventually happens.
const TOKEN_TIMEOUT_MS = 10_000
const REQUEST_TIMEOUT_MS = 15_000

// Same shape as useScreenerPresets' own copy — the BFF's error responses are
// { error: { message: "..." } } across its /screener/* routes, not just this one. Kept as a
// separate copy rather than a shared import since both composables are otherwise
// independent and this is a small, self-contained piece of parsing.
function describeError(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('data' in error)) return null
  const data = (error as { data?: unknown }).data
  if (!data || typeof data !== 'object' || !('error' in data)) return null
  const inner = (data as { error?: unknown }).error
  if (!inner || typeof inner !== 'object' || !('message' in inner)) return null
  const message = (inner as { message?: unknown }).message
  return typeof message === 'string' ? message : null
}

export function useScreenerColumnPresets() {
  const config = useRuntimeConfig()
  const currentUser = useCurrentUser()

  // Set by warn() on every failed request, read by callers right after an await that came
  // back falsy — lets them show the BFF's actual reason instead of only a generic message.
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
    console.warn(`[screener-column-presets] ${action} failed (${reason})`)
  }

  async function list(): Promise<ScreenerColumnPreset[]> {
    const headers = await authHeader()
    if (!headers) return []
    try {
      const response = await $fetch<{ columnPresets: ScreenerColumnPreset[] }>('/screener/column-presets', {
        baseURL: config.public.apiBase,
        headers,
        timeout: REQUEST_TIMEOUT_MS
      })
      return response.columnPresets
    } catch (error) {
      warn('GET /screener/column-presets', error)
      return []
    }
  }

  async function create(name: string, fields: string[], isDefault = false): Promise<ScreenerColumnPreset | null> {
    const headers = await authHeader()
    if (!headers) return null
    try {
      const response = await $fetch<{ columnPreset: ScreenerColumnPreset }>('/screener/column-presets', {
        baseURL: config.public.apiBase,
        method: 'POST',
        headers,
        body: { name, isDefault, columns: fields.map(field => ({ field })) },
        timeout: REQUEST_TIMEOUT_MS
      })
      return response.columnPreset
    } catch (error) {
      warn('POST /screener/column-presets', error)
      return null
    }
  }

  async function update(
    id: string,
    patch: { name?: string; isDefault?: boolean; fields?: string[] }
  ): Promise<ScreenerColumnPreset | null> {
    const headers = await authHeader()
    if (!headers) return null
    try {
      const response = await $fetch<{ columnPreset: ScreenerColumnPreset }>(`/screener/column-presets/${id}`, {
        baseURL: config.public.apiBase,
        method: 'PATCH',
        headers,
        body: {
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.isDefault !== undefined ? { isDefault: patch.isDefault } : {}),
          ...(patch.fields !== undefined ? { columns: patch.fields.map(field => ({ field })) } : {})
        },
        timeout: REQUEST_TIMEOUT_MS
      })
      return response.columnPreset
    } catch (error) {
      warn(`PATCH /screener/column-presets/${id}`, error)
      return null
    }
  }

  async function remove(id: string): Promise<boolean> {
    const headers = await authHeader()
    if (!headers) return false
    try {
      await $fetch(`/screener/column-presets/${id}`, {
        baseURL: config.public.apiBase,
        method: 'DELETE',
        headers,
        timeout: REQUEST_TIMEOUT_MS
      })
      return true
    } catch (error) {
      warn(`DELETE /screener/column-presets/${id}`, error)
      return false
    }
  }

  // No auth header — GET /screener/column-preset-templates is public (same as GET
  // /screener/templates for filter presets), so browsing official column sets works
  // signed-out too.
  async function listTemplates(): Promise<ColumnPresetTemplate[]> {
    try {
      const response = await $fetch<{ templates: ColumnPresetTemplate[] }>('/screener/column-preset-templates', {
        baseURL: config.public.apiBase,
        timeout: REQUEST_TIMEOUT_MS
      })
      return response.templates
    } catch (error) {
      warn('GET /screener/column-preset-templates', error)
      return []
    }
  }

  // Clones the template's fieldKeys into a brand-new, personal ColumnPreset owned by the
  // caller (named after the template, "name 2"/"name 3" on repeat applies per bff-ts) —
  // requires login, unlike listTemplates above.
  async function applyTemplate(key: string): Promise<ScreenerColumnPreset | null> {
    const headers = await authHeader()
    if (!headers) return null
    try {
      const response = await $fetch<{ preset: ScreenerColumnPreset }>(`/screener/column-preset-templates/${key}/apply`, {
        baseURL: config.public.apiBase,
        method: 'POST',
        headers,
        timeout: REQUEST_TIMEOUT_MS
      })
      return response.preset
    } catch (error) {
      warn(`POST /screener/column-preset-templates/${key}/apply`, error)
      return null
    }
  }

  return { list, create, update, remove, listTemplates, applyTemplate, lastErrorMessage }
}
