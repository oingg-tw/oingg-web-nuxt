import type { FilterCriterion } from '~/composables/screener/useFilterSearch'
import type { ScreenerPreset } from '~/composables/screener/useScreenerPresets'

// 官方維護的策略（例如「巴菲特護城河」），使用者可以複製成自己的篩選分頁；跟永遠是使用者擁有的 ScreenerPreset 不同。
// GET /screener/templates 實測：PENDING 的（產品命名了但還跑不了，見 pendingReason）`filters` 是空陣列——列出來讓人看到，
// 但永遠不能選。
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
  // bff-ts 08facd6（2026-09-11）：純粹的曝光訊號，同時只有一個範本是 true（目前是股利穩健），伺服器不會自動套用
  // （POST /screener 仍要求至少一個條件）。用在 useScreenerTabs 的 addDefaultTab：新使用者的第一個分頁從它長出來
  // （使用者確認「自動套用股利穩健」）；新分頁對話框的「自訂篩選邏輯」不受影響，仍是 ROE > 30。
  isDefault: boolean
}

export function useScreenerTemplates() {
  const currentUser = useCurrentUser()
  const authedFetch = useAuthedFetch()

  const lastErrorMessage = ref<string | null>(null)
  // 錯誤代碼（2026-10-06）：quota_exceeded 要顯示「額度已滿＋看方案」，不是通用的失敗訊息
  const lastErrorCode = ref<string | null>(null)

  function warn(action: string, error: unknown) {
    lastErrorMessage.value = describeBffError(error)
    lastErrorCode.value = bffErrorCode(error) ?? null
    devWarn('screener-templates', `${action} failed`, error)
  }

  // 公開端點（實測不帶 Authorization 也回），登出也能瀏覽官方策略
  async function list(): Promise<ScreenerTemplate[]> {
    try {
      const response = await apiFetch<{ templates: ScreenerTemplate[] }>('/screener/templates')
      return response.templates
    } catch (error) {
      warn('GET /screener/templates', error)
      return []
    }
  }

  // 把範本的條件複製成呼叫者自己的新 ScreenerPreset；要登入
  async function apply(id: string): Promise<ScreenerPreset | null> {
    if (!currentUser.value) return null
    try {
      const response = await authedFetch<{ preset: ScreenerPreset }>(`/screener/templates/${id}/apply`, { method: 'POST' })
      return response.preset
    } catch (error) {
      warn(`POST /screener/templates/${id}/apply`, error)
      return null
    }
  }

  return { list, apply, lastErrorMessage, lastErrorCode }
}
