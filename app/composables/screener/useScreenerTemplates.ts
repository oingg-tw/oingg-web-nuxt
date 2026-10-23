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
  // 業務中台 08facd6（2026-09-11）：純粹的曝光訊號，同時只有一個範本是 true（目前是股利穩健），伺服器不會自動套用
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
    lastErrorMessage.value = describeBusinessError(error)
    lastErrorCode.value = businessErrorCode(error) ?? null
    devWarn('screener-templates', `${action} failed`, error)
  }

  // 公開端點（實測不帶 Authorization 也回），登出也能瀏覽官方策略
  async function list(): Promise<ScreenerTemplate[]> {
    try {
      const response = await apiFetch<{ templates: ScreenerTemplate[] }>('/screener/templates', { baseURL: BUSINESS_CACHED_BASE })
      return response.templates
    } catch (error) {
      // 讀不到往上丟（2026-10-11）：載入器會報給全站讀取失敗彈窗；原本回 [] 會被當成「目前沒有可用的策略」而且不再重試
      warn('GET /screener/templates', error)
      throw error
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

// 官方範本清單：訪客的選範本畫面（useGuestScreener）與登入後的「新增篩選」彈窗（useScreenerTabCrud）共用一份（2026-10-23 合併兩處各自的
// 載入器）。清單放 useState，伺服器端抓好的（頁面資料帶過來）就不再抓——重抓那段時間 templatesLoading 是 true，格子會換回「載入中…」。
// 進行中被呼叫就等同一個（普通股頁在 setup 就先抓，?template 的解析稍後才來問；以前是布林旗標，進行中被呼叫直接回傳，templateBySlug
// 拿到空清單、誤退回選範本）。失敗就清掉、報給全站讀取失敗彈窗，重試才會再抓（以前先設已載入，失敗之後整個 session 都是空清單）
export function useScreenerTemplateList() {
  const { list } = useScreenerTemplates()
  const templates = useState<ScreenerTemplate[]>('screener-templates', () => [])
  const templatesLoading = ref(false)
  let templatesPromise: Promise<void> | null = null
  const templatesFailure = shallowRef<unknown>(null)
  watchLoadFailure('screener-templates', () => templatesFailure.value, () => loadTemplatesIfNeeded(), { scope: 'section' })

  function loadTemplatesIfNeeded(): Promise<void> {
    if (templates.value.length) return Promise.resolve()
    templatesPromise ??= (async () => {
      templatesLoading.value = true
      try {
        templates.value = await list()
        templatesFailure.value = null
      } catch (error) {
        templatesPromise = null
        templatesFailure.value = error
      } finally {
        templatesLoading.value = false
      }
    })()
    return templatesPromise
  }

  return { templates, templatesLoading, loadTemplatesIfNeeded }
}
