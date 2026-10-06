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
  status: 'AVAILABLE' | 'PENDING'
  pendingReason: string | null
  filters: FilterCriterion[]
  createdAt: string
  updatedAt: string
  // Added by bff-ts 2026-09-11 (commit 08facd6) — a pure discoverability signal, exactly one
  // template true at a time (currently 股利穩健). bff-ts does NOT auto-apply this server-side
  // (POST /screener still requires at least one explicit filter, unchanged); it's on this app to
  // decide whether/how to use it. Wired into useScreenerTabs.ts's addDefaultTab() per direct
  // confirmation ("自動套用股利穩健") — a brand-new user's very first screener tab now seeds from
  // this template instead of sitting empty, but the "自訂篩選邏輯" custom-tab choice in the
  // new-tab dialog stays untouched (still ROE > 30), since a user who explicitly chose "custom"
  // over browsing official strategies shouldn't be handed one anyway.
  isDefault: boolean
}


// Same shape/reasoning as useScreenerPresets.ts's own describeError — kept as an
// independent copy rather than a shared import, matching useScreenerColumnPresets.ts.

export function useScreenerTemplates() {
  const authHeader = useAuthHeader()
  const config = useRuntimeConfig()

  const lastErrorMessage = ref<string | null>(null)
  // 錯誤代碼（2026-10-06）：quota_exceeded 要顯示「額度已滿＋看方案」，不是通用的失敗訊息
  const lastErrorCode = ref<string | null>(null)

  function warn(action: string, error: unknown) {
    lastErrorMessage.value = describeBffError(error)
    lastErrorCode.value = bffErrorCode(error) ?? null
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
        timeout: BFF_REQUEST_TIMEOUT_MS
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
    try {
      // authHeader() 回 null 就是「沒有登入的人」，等同這裡原本的 `if (!currentUser.value) return null`
      // ——那個判斷現在在共用的 useAuthHeader 裡。放在 try 之內是刻意的：換 token 是一次網路往返，
      // 逾時要被下面的 catch 接住並 warn，跟原本的行為一致。
      const headers = await authHeader()
      if (!headers) return null
      const response = await $fetch<{ preset: ScreenerPreset }>(`/screener/templates/${id}/apply`, {
        baseURL: config.public.apiBase,
        method: 'POST',
        headers,
        timeout: BFF_REQUEST_TIMEOUT_MS
      })
      return response.preset
    } catch (error) {
      warn(`POST /screener/templates/${id}/apply`, error)
      return null
    }
  }

  return { list, apply, lastErrorMessage, lastErrorCode }
}
