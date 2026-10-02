import type { StockExperienceMode } from '~/composables/stock/useStockExperienceMode'

// Wraps bff-ts's stock-detail-preference contract, confirmed live 2026-09-07: GET/PUT
// /users/me/stock-detail-preferences, wrapped under a top-level "stockDetailPreferences" key —
// same GET/PUT-with-Bearer-token shape as useUserDashboardCards.ts, kept as an independent copy
// rather than a shared import, matching that file's own precedent. PUT is a full overwrite of
// BOTH fields together (no endpoint to change just one), so callers must always send the
// complete current mode + visibleCardIds, not just whichever one changed. mode is bff-ts-
// validated (400 if missing or outside CARD/ACCOUNTING); visibleCardIds is an unvalidated
// opaque string array, same as dashboardCards.
export interface UserStockDetailPreferences {
  // null = this account has never saved a preference — apply the local default. [] on
  // visibleCardIds means the user explicitly turned every card off. These are NOT the same
  // thing; don't collapse one into the other (see useUserDashboardCards.ts's own comment for
  // how this distinction is used).
  mode: StockExperienceMode | null
  visibleCardIds: string[] | null
  // 釘在側邊欄的指標頁 slug，順序就是側邊欄的排列順序（bff-ts 668df6d，2026-09-26）。
  //
  // 跟 visibleCardIds 同樣的 null 語意：null ＝ 這個帳號從來沒存過，套用本地預設；[] ＝ 使用者把釘選
  // 全部取消了。兩者不同義，不要合併。
  //
  // 這一欄在 PUT 上是**選填**，而且後端「沒送就不動」——那是部署順序的考量，不是為部分更新預留的通用
  // 機制：做成必填的話，在前端改成三欄一起送之前，現有的兩欄 PUT 會每次 400；缺席當成 [] 的話，每存
  // 一次卡片設定就清空使用者的釘選。我們這邊三個一起送，所以那條分支不會走到。
  pinnedMetricSlugs: string[] | null
}

const REQUEST_TIMEOUT_MS = 15_000


export function useUserStockDetailPreferences() {
  const config = useRuntimeConfig()
  const currentUser = useCurrentUser()

  const lastErrorMessage = ref<string | null>(null)

  const authHeader = useAuthHeader()

  // No showErrorMessage here on purpose — same reasoning as useUserDashboardCards.ts's warn():
  // a failed sync never breaks the picker itself (already applied locally the moment it
  // changed), just leaves this one device's choice unsaved to the account until the next
  // successful sync.
  function warn(action: string, error: unknown) {
    lastErrorMessage.value = describeBffError(error)
    if (!import.meta.dev) return
    const reason = error instanceof Error ? error.message : String(error)
    console.warn(`[user-stock-detail-preferences] ${action} failed (${reason})`)
  }

  // Returns undefined when the fetch couldn't happen at all (not signed in, network/auth
  // failure) — callers should leave local state untouched in that case, distinct from a
  // successful response whose fields are individually null (see the interface's own comment).
  async function fetchStockDetailPreferences(): Promise<UserStockDetailPreferences | undefined> {
    const headers = await authHeader()
    if (!headers) return undefined
    try {
      const response = await $fetch<{ stockDetailPreferences: UserStockDetailPreferences }>('/users/me/stock-detail-preferences', {
        baseURL: config.public.apiBase,
        headers,
        timeout: REQUEST_TIMEOUT_MS,
        cache: 'no-store'
      })
      return response.stockDetailPreferences
    } catch (error) {
      warn('GET /users/me/stock-detail-preferences', error)
      return undefined
    }
  }

  async function putStockDetailPreferences(preferences: { mode: StockExperienceMode; visibleCardIds: string[]; pinnedMetricSlugs: string[] }): Promise<boolean> {
    const headers = await authHeader()
    if (!headers) return false
    try {
      await $fetch('/users/me/stock-detail-preferences', {
        baseURL: config.public.apiBase,
        method: 'PUT',
        headers,
        body: preferences,
        timeout: REQUEST_TIMEOUT_MS
      })
      return true
    } catch (error) {
      warn('PUT /users/me/stock-detail-preferences', error)
      return false
    }
  }

  return { fetchStockDetailPreferences, putStockDetailPreferences, lastErrorMessage }
}
