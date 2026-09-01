import type { MarketConvention, ThemeColor, ThemeMode } from '~/composables/theme/useAppTheme'

// Wraps bff-ts's theme-preference contract, confirmed live 2026-08-31 (see
// useAppTheme.ts's own top comment for the full history — this replaced an earlier combined
// PUT mid-session): GET returns all three fields together, each has its own single-field
// PUT. Same auth/timeout/error-reporting shape as useScreenerPresets.ts — kept as an
// independent copy rather than a shared import, matching that file's own precedent.
export interface UserThemePreferences {
  mode: ThemeMode
  accentColor: ThemeColor
  marketColorConvention: MarketConvention
  // Added 2026-09-01 — additive, same GET/PUT-per-field shape as the three above. Confirmed
  // live with bff-ts: the DB column is nullable but that never surfaces through the API (GET
  // always resolves null -> the column's own default before responding, same as the other
  // three fields), and the default was corrected to `true` to match this app's actual live
  // layout — every existing account (nobody's explicitly set this yet) reads `true` here.
  isFullWidth: boolean
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

export function useUserTheme() {
  const config = useRuntimeConfig()
  const currentUser = useCurrentUser()

  const lastErrorMessage = ref<string | null>(null)

  async function authHeader() {
    if (!currentUser.value) return null
    const token = await withTimeout(currentUser.value.getIdToken(), TOKEN_TIMEOUT_MS, '登入驗證逾時')
    return { Authorization: `Bearer ${token}` }
  }

  // No showErrorMessage here on purpose — a failed sync never breaks the theme itself
  // (it's already applied locally the moment setMode/setColor/setMarket runs), just leaves
  // this one device's choice unsaved to the account until the next successful sync. Not
  // worth interrupting the user with a toast for a background preference save.
  function warn(action: string, error: unknown) {
    lastErrorMessage.value = describeError(error)
    if (!import.meta.dev) return
    const reason = error instanceof Error ? error.message : String(error)
    console.warn(`[user-theme] ${action} failed (${reason})`)
  }

  async function fetchTheme(): Promise<UserThemePreferences | null> {
    const headers = await authHeader()
    if (!headers) return null
    try {
      // Live response is wrapped ({ theme: { mode, accentColor, marketColorConvention } }),
      // not flat — confirmed 2026-08-31 by inspecting the actual GET response body (the
      // earlier "flat" contract description didn't match bff-ts's real implementation).
      const response = await $fetch<{ theme: UserThemePreferences }>('/users/me/theme', {
        baseURL: config.public.apiBase,
        headers,
        timeout: REQUEST_TIMEOUT_MS,
        cache: 'no-store'
      })
      return response.theme
    } catch (error) {
      warn('GET /users/me/theme', error)
      return null
    }
  }

  async function putMode(mode: ThemeMode): Promise<boolean> {
    const headers = await authHeader()
    if (!headers) return false
    try {
      await $fetch('/users/me/theme/mode', {
        baseURL: config.public.apiBase,
        method: 'PUT',
        headers,
        body: { mode },
        timeout: REQUEST_TIMEOUT_MS
      })
      return true
    } catch (error) {
      warn('PUT /users/me/theme/mode', error)
      return false
    }
  }

  async function putAccentColor(accentColor: ThemeColor): Promise<boolean> {
    const headers = await authHeader()
    if (!headers) return false
    try {
      await $fetch('/users/me/theme/accent-color', {
        baseURL: config.public.apiBase,
        method: 'PUT',
        headers,
        body: { accentColor },
        timeout: REQUEST_TIMEOUT_MS
      })
      return true
    } catch (error) {
      warn('PUT /users/me/theme/accent-color', error)
      return false
    }
  }

  async function putMarketColorConvention(marketColorConvention: MarketConvention): Promise<boolean> {
    const headers = await authHeader()
    if (!headers) return false
    try {
      await $fetch('/users/me/theme/market-color-convention', {
        baseURL: config.public.apiBase,
        method: 'PUT',
        headers,
        body: { marketColorConvention },
        timeout: REQUEST_TIMEOUT_MS
      })
      return true
    } catch (error) {
      warn('PUT /users/me/theme/market-color-convention', error)
      return false
    }
  }

  async function putFullWidth(isFullWidth: boolean): Promise<boolean> {
    const headers = await authHeader()
    if (!headers) return false
    try {
      await $fetch('/users/me/theme/full-width', {
        baseURL: config.public.apiBase,
        method: 'PUT',
        headers,
        body: { isFullWidth },
        timeout: REQUEST_TIMEOUT_MS
      })
      return true
    } catch (error) {
      warn('PUT /users/me/theme/full-width', error)
      return false
    }
  }

  return { fetchTheme, putMode, putAccentColor, putMarketColorConvention, putFullWidth, lastErrorMessage }
}
