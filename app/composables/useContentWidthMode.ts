export type ContentWidthMode = 'full' | 'centered'

const STORAGE_KEY = 'oingg-content-width-mode'

// Whether the app's main content area (both layouts' .app-shell__content, see
// desktop.vue/mobile.vue) runs edge-to-edge ("滿版", this app's existing/only behavior until
// now — so 'full' has to stay the default, or every current user's layout would silently
// shift) or caps to a centered, Bootstrap-style column ("置中"). Its own switch lives in
// StockSearchBar.vue, outside any one page, since it's a global look — not a screener-only
// setting like useScreenerShowPeriod.
//
// Persisted to localStorage rather than useScreenerShowPeriod's plain (reset-on-refresh)
// useState, or useUserTheme's full server-synced account preference — this is a pure
// client-side visual choice with no cross-device/account meaning, so a network round-trip
// (and the auth it'd require) would be overkill for it. Reading localStorage only in
// onMounted (never during the initial render) keeps the server and the client's first paint
// in agreement — matches this app's other client-only-state patterns (see useHasHydrated.ts).
export function useContentWidthMode() {
  const mode = useState<ContentWidthMode>('content-width-mode', () => 'full')

  onMounted(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'full' || stored === 'centered') mode.value = stored
  })

  watch(mode, value => {
    window.localStorage.setItem(STORAGE_KEY, value)
  })

  return mode
}
