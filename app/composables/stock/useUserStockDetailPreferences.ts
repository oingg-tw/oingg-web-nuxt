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
}

const TOKEN_TIMEOUT_MS = 10_000
const REQUEST_TIMEOUT_MS = 15_000

function describeError(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('data' in error)) return null
  const data = (error as { data?: unknown }).data
  if (!data || typeof data !== 'object' || !('error' in data)) return null
  const inner = (data as { error?: unknown }).error
  if (!inner || typeof inner !== 'object' || !('message' in inner)) return null
  const message = (inner as { message?: unknown }).message
  return typeof message === 'string' ? message : null
}

export function useUserStockDetailPreferences() {
  const config = useRuntimeConfig()
  const currentUser = useCurrentUser()

  const lastErrorMessage = ref<string | null>(null)

  async function authHeader() {
    if (!currentUser.value) return null
    const token = await withTimeout(currentUser.value.getIdToken(), TOKEN_TIMEOUT_MS, '登入驗證逾時')
    return { Authorization: `Bearer ${token}` }
  }

  // No showErrorMessage here on purpose — same reasoning as useUserDashboardCards.ts's warn():
  // a failed sync never breaks the picker itself (already applied locally the moment it
  // changed), just leaves this one device's choice unsaved to the account until the next
  // successful sync.
  function warn(action: string, error: unknown) {
    lastErrorMessage.value = describeError(error)
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

  async function putStockDetailPreferences(preferences: { mode: StockExperienceMode; visibleCardIds: string[] }): Promise<boolean> {
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
