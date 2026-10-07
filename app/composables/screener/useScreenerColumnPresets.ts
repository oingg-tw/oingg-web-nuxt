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

// 顯示欄位是自己的具名資源 /screener/column-presets（bff-ts /api-docs 實測），不是每人一個的全域槽。`field` 是 GET /metrics 的
// "<metricKey>.<fieldKey>"，外加型錄裡沒有的 "stock.price"。`isDefault` 互斥：設了就取消同一人其他的預設。
// 回應外層是 {columnPreset}／{columnPresets}（比照 /screener/presets 已確認的 {preset}／{presets}）。

export function useScreenerColumnPresets() {

  // Set by warn() on every failed request, read by callers right after an await that came
  // back falsy — lets them show the BFF's actual reason instead of only a generic message.
  const lastErrorMessage = ref<string | null>(null)
  // 錯誤代碼（2026-10-06）：quota_exceeded 要顯示「額度已滿＋看方案」，不是通用的失敗訊息
  const lastErrorCode = ref<string | null>(null)

  const authHeader = useAuthHeader()

  function warn(action: string, error: unknown) {
    lastErrorMessage.value = describeBffError(error)
    lastErrorCode.value = bffErrorCode(error) ?? null
    if (!import.meta.dev) return
    const reason = error instanceof Error ? error.message : String(error)
    console.warn(`[screener-column-presets] ${action} failed (${reason})`)
  }

  async function list(): Promise<ScreenerColumnPreset[]> {
    const headers = await authHeader()
    if (!headers) return []
    try {
      const response = await $fetch<{ columnPresets: ScreenerColumnPreset[] }>('/screener/column-presets', {
        baseURL: BFF_BASE,
        headers,
        timeout: BFF_REQUEST_TIMEOUT_MS
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
        baseURL: BFF_BASE,
        method: 'POST',
        headers,
        body: { name, isDefault, columns: fields.map(field => ({ field })) },
        timeout: BFF_REQUEST_TIMEOUT_MS
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
        baseURL: BFF_BASE,
        method: 'PATCH',
        headers,
        body: {
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.isDefault !== undefined ? { isDefault: patch.isDefault } : {}),
          ...(patch.fields !== undefined ? { columns: patch.fields.map(field => ({ field })) } : {})
        },
        timeout: BFF_REQUEST_TIMEOUT_MS
      })
      return response.columnPreset
    } catch (error) {
      warn(`PATCH /screener/column-presets/${id}`, error)
      return null
    }
  }

  // New endpoint requested from bff-ts 2026-09-11 (relayed live: "分頁標籤 也要持久化") once
  // drag-reordering the column-preset tab strip turned out to be a purely local, session-only
  // illusion — GET /screener/column-presets carried no order field, so a reload always reverted
  // to createdAt-desc. bff-ts's own contract (commit 02529cd): takes the caller's FULL ordered
  // set of their own column-preset ids, not a single-item position patch or an incremental diff
  // — 400s if it doesn't exactly match their current set (missing or extra ids both rejected).
  async function reorder(ids: string[]): Promise<boolean> {
    const headers = await authHeader()
    if (!headers) return false
    try {
      await $fetch('/screener/column-presets/reorder', {
        baseURL: BFF_BASE,
        method: 'POST',
        headers,
        body: { ids },
        timeout: BFF_REQUEST_TIMEOUT_MS
      })
      return true
    } catch (error) {
      warn('POST /screener/column-presets/reorder', error)
      return false
    }
  }

  async function remove(id: string): Promise<boolean> {
    const headers = await authHeader()
    if (!headers) return false
    try {
      await $fetch(`/screener/column-presets/${id}`, {
        baseURL: BFF_BASE,
        method: 'DELETE',
        headers,
        timeout: BFF_REQUEST_TIMEOUT_MS
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
        baseURL: BFF_BASE,
        timeout: BFF_REQUEST_TIMEOUT_MS
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
        baseURL: BFF_BASE,
        method: 'POST',
        headers,
        timeout: BFF_REQUEST_TIMEOUT_MS
      })
      return response.preset
    } catch (error) {
      warn(`POST /screener/column-preset-templates/${key}/apply`, error)
      return null
    }
  }

  return { list, create, update, remove, reorder, listTemplates, applyTemplate, lastErrorMessage, lastErrorCode }
}
