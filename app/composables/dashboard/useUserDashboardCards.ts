// Wraps bff-ts's dashboard-card-preference contract, confirmed live 2026-09-02: GET/PUT
// /users/me/dashboard-cards, both wrapped under a top-level "dashboardCards" key (same
// GET/PUT-with-Bearer-token shape as useUserTheme.ts, kept as an independent copy rather than
// a shared import, matching that file's own precedent). PUT is a full overwrite, not an
// incremental add/remove — callers must send the complete list they want kept. Card ids are
// stored as opaque strings with no server-side validation — new card ids never need bff-ts to
// know about them ahead of time.
export interface UserDashboardCardsPreferences {
  // null = this account has never saved a preference — apply the local default. [] = the user
  // explicitly turned every card off. These are NOT the same thing; don't collapse one into
  // the other (see useDashboardCards.ts's own sync logic for how this distinction is used).
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

export function useUserDashboardCards() {
  const config = useRuntimeConfig()
  const currentUser = useCurrentUser()

  const lastErrorMessage = ref<string | null>(null)

  async function authHeader() {
    if (!currentUser.value) return null
    const token = await withTimeout(currentUser.value.getIdToken(), TOKEN_TIMEOUT_MS, '登入驗證逾時')
    return { Authorization: `Bearer ${token}` }
  }

  // No showErrorMessage here on purpose — same reasoning as useUserTheme.ts's warn(): a failed
  // sync never breaks the picker itself (already applied locally the moment it changed), just
  // leaves this one device's choice unsaved to the account until the next successful sync.
  function warn(action: string, error: unknown) {
    lastErrorMessage.value = describeError(error)
    if (!import.meta.dev) return
    const reason = error instanceof Error ? error.message : String(error)
    console.warn(`[user-dashboard-cards] ${action} failed (${reason})`)
  }

  // Returns undefined when the fetch couldn't happen at all (not signed in, network/auth
  // failure) — callers should leave local state untouched in that case, distinct from a
  // successful response whose own visibleCardIds is null (see the interface's own comment).
  async function fetchDashboardCards(): Promise<string[] | null | undefined> {
    const headers = await authHeader()
    if (!headers) return undefined
    try {
      const response = await $fetch<{ dashboardCards: UserDashboardCardsPreferences }>('/users/me/dashboard-cards', {
        baseURL: config.public.apiBase,
        headers,
        timeout: REQUEST_TIMEOUT_MS,
        cache: 'no-store'
      })
      return response.dashboardCards.visibleCardIds
    } catch (error) {
      warn('GET /users/me/dashboard-cards', error)
      return undefined
    }
  }

  async function putDashboardCards(visibleCardIds: string[]): Promise<boolean> {
    const headers = await authHeader()
    if (!headers) return false
    try {
      await $fetch('/users/me/dashboard-cards', {
        baseURL: config.public.apiBase,
        method: 'PUT',
        headers,
        body: { visibleCardIds },
        timeout: REQUEST_TIMEOUT_MS
      })
      return true
    } catch (error) {
      warn('PUT /users/me/dashboard-cards', error)
      return false
    }
  }

  return { fetchDashboardCards, putDashboardCards, lastErrorMessage }
}
