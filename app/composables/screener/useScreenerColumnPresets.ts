export interface ScreenerColumnPresetField {
  field: string
}

// 官方的欄位組合（存股領息／價值投資／財務體質排雷…，來自 analysis-ts），使用者可以複製成自己的 column-preset。
// 對應篩選條件那邊的 ScreenerTemplate，但沒有 category／tier／status（bff-ts 2026-09-01 實測），就是一份平的清單。
export interface ColumnPresetTemplate {
  key: string
  name: string
  description: string
  fieldKeys: string[]
}

// id 是 UUID 不是流水號（bff-ts c40fa87，見 ScreenerPreset 的說明），不要 Number(id)。
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
  const currentUser = useCurrentUser()
  const authedFetch = useAuthedFetch()

  // 每次失敗都更新，呼叫端在拿到 falsy 回傳值之後讀：訊息是 bff 給的理由（沒有就 null，呼叫端用自己的文案）；
  // 代碼讓 quota_exceeded 顯示「額度已滿＋看方案」而不是通用的失敗訊息（2026-10-06）
  const lastErrorMessage = ref<string | null>(null)
  const lastErrorCode = ref<string | null>(null)

  function warn(action: string, error: unknown) {
    lastErrorMessage.value = describeBffError(error)
    lastErrorCode.value = bffErrorCode(error) ?? null
    devWarn('screener-column-presets', `${action} failed`, error)
  }

  async function list(): Promise<ScreenerColumnPreset[]> {
    if (!currentUser.value) return []
    try {
      const response = await authedFetch<{ columnPresets: ScreenerColumnPreset[] }>('/screener/column-presets')
      return response.columnPresets
    } catch (error) {
      warn('GET /screener/column-presets', error)
      return []
    }
  }

  async function create(name: string, fields: string[], isDefault = false): Promise<ScreenerColumnPreset | null> {
    if (!currentUser.value) return null
    try {
      const response = await authedFetch<{ columnPreset: ScreenerColumnPreset }>('/screener/column-presets', {
        method: 'POST',
        body: { name, isDefault, columns: fields.map(field => ({ field })) }
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
    if (!currentUser.value) return null
    try {
      const response = await authedFetch<{ columnPreset: ScreenerColumnPreset }>(`/screener/column-presets/${id}`, {
        method: 'PATCH',
        body: {
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.isDefault !== undefined ? { isDefault: patch.isDefault } : {}),
          ...(patch.fields !== undefined ? { columns: patch.fields.map(field => ({ field })) } : {})
        }
      })
      return response.columnPreset
    } catch (error) {
      warn(`PATCH /screener/column-presets/${id}`, error)
      return null
    }
  }

  // 整份取代（bff-ts 02529cd，2026-09-11 向他們要的）：呼叫端自己全部 column-preset 的 id、照順序；缺或多任何一個都回 400。
  // 沒有這支之前拖曳排序只是分頁內的假象——GET 沒有 order 欄位，重新整理就回到 createdAt desc。
  async function reorder(ids: string[]): Promise<boolean> {
    if (!currentUser.value) return false
    try {
      await authedFetch('/screener/column-presets/reorder', { method: 'POST', body: { ids } })
      return true
    } catch (error) {
      warn('POST /screener/column-presets/reorder', error)
      return false
    }
  }

  async function remove(id: string): Promise<boolean> {
    if (!currentUser.value) return false
    try {
      await authedFetch(`/screener/column-presets/${id}`, { method: 'DELETE' })
      return true
    } catch (error) {
      warn(`DELETE /screener/column-presets/${id}`, error)
      return false
    }
  }

  // 公開端點（跟 GET /screener/templates 一樣不帶身分），登出也能瀏覽官方欄位組合
  async function listTemplates(): Promise<ColumnPresetTemplate[]> {
    try {
      const response = await apiFetch<{ templates: ColumnPresetTemplate[] }>('/screener/column-preset-templates')
      return response.templates
    } catch (error) {
      warn('GET /screener/column-preset-templates', error)
      return []
    }
  }

  // 把範本的 fieldKeys 複製成呼叫者自己的新 ColumnPreset（名稱照範本，重複套用時 bff 加「 2」「 3」）；要登入
  async function applyTemplate(key: string): Promise<ScreenerColumnPreset | null> {
    if (!currentUser.value) return null
    try {
      const response = await authedFetch<{ preset: ScreenerColumnPreset }>(`/screener/column-preset-templates/${key}/apply`, { method: 'POST' })
      return response.preset
    } catch (error) {
      warn(`POST /screener/column-preset-templates/${key}/apply`, error)
      return null
    }
  }

  return { list, create, update, remove, reorder, listTemplates, applyTemplate, lastErrorMessage, lastErrorCode }
}
