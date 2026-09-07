import type { ColumnId, ColumnPresetId } from '~/composables/preferred/usePreferredStocksColumnPreferences'

// Wraps bff-ts's preferred-stocks-preference contract, confirmed live 2026-09-07: GET/PUT
// /users/me/preferred-stocks-preferences, wrapped under a top-level
// "preferredStocksPreferences" key — same GET/PUT-with-Bearer-token shape as
// useUserStockDetailPreferences.ts, kept as an independent copy rather than a shared import,
// matching that file's own precedent. PUT is a full overwrite of BOTH fields together (no
// endpoint to change just one). columnPresetId is bff-ts-validated (400 if missing or outside
// ALL/CONTRACT_TERMS/VALUATION/CALL_RISK, strict on casing — "contract_terms" is rejected);
// columnOrder is an unvalidated opaque string array, same as dashboardCards/visibleCardIds.
export interface UserPreferredStocksPreferences {
  // null on either field = this account has never saved a preference — apply the local
  // default. Don't collapse into an empty array/whatever the default happens to be — see
  // useUserDashboardCards.ts's own comment for why that distinction matters.
  columnPresetId: ColumnPresetId | null
  columnOrder: ColumnId[] | null
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

export function useUserPreferredStocksPreferences() {
  const config = useRuntimeConfig()
  const currentUser = useCurrentUser()

  const lastErrorMessage = ref<string | null>(null)

  async function authHeader() {
    if (!currentUser.value) return null
    const token = await withTimeout(currentUser.value.getIdToken(), TOKEN_TIMEOUT_MS, '登入驗證逾時')
    return { Authorization: `Bearer ${token}` }
  }

  // No showErrorMessage here on purpose — same reasoning as useUserDashboardCards.ts's warn():
  // a failed sync never breaks the picker/reorder itself (already applied locally the moment
  // it changed), just leaves this one device's choice unsaved to the account until the next
  // successful sync.
  function warn(action: string, error: unknown) {
    lastErrorMessage.value = describeError(error)
    if (!import.meta.dev) return
    const reason = error instanceof Error ? error.message : String(error)
    console.warn(`[user-preferred-stocks-preferences] ${action} failed (${reason})`)
  }

  // Returns undefined when the fetch couldn't happen at all (not signed in, network/auth
  // failure) — callers should leave local state untouched in that case, distinct from a
  // successful response whose fields are individually null (see the interface's own comment).
  async function fetchPreferredStocksPreferences(): Promise<UserPreferredStocksPreferences | undefined> {
    const headers = await authHeader()
    if (!headers) return undefined
    try {
      const response = await $fetch<{ preferredStocksPreferences: UserPreferredStocksPreferences }>('/users/me/preferred-stocks-preferences', {
        baseURL: config.public.apiBase,
        headers,
        timeout: REQUEST_TIMEOUT_MS,
        cache: 'no-store'
      })
      return response.preferredStocksPreferences
    } catch (error) {
      warn('GET /users/me/preferred-stocks-preferences', error)
      return undefined
    }
  }

  async function putPreferredStocksPreferences(preferences: { columnPresetId: ColumnPresetId; columnOrder: ColumnId[] }): Promise<boolean> {
    const headers = await authHeader()
    if (!headers) return false
    try {
      await $fetch('/users/me/preferred-stocks-preferences', {
        baseURL: config.public.apiBase,
        method: 'PUT',
        headers,
        body: preferences,
        timeout: REQUEST_TIMEOUT_MS
      })
      return true
    } catch (error) {
      warn('PUT /users/me/preferred-stocks-preferences', error)
      return false
    }
  }

  return { fetchPreferredStocksPreferences, putPreferredStocksPreferences, lastErrorMessage }
}
