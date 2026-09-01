export type ContentWidthMode = 'full' | 'centered'

// Whether the app's main content area (both layouts' .app-shell__content, see
// desktop.vue/mobile.vue) runs edge-to-edge ("滿版") or caps to a centered, Bootstrap-style
// column ("置中"). Its own switch lives in StockSearchBar.vue, outside any one page, since
// it's a global look — not a screener-only setting like useScreenerShowPeriod.
//
// Thin string<->boolean adapter over useAppTheme's cookie-backed, account-synced fullWidth —
// bff-ts groups isFullWidth with mode/accentColor/marketColorConvention under GET/PUT
// /users/me/theme (added 2026-09-01), not its own resource, so this rides on that same
// SSR-correct, server-synced state rather than keeping a separate localStorage-only copy
// (which is what this composable used to be, before that endpoint existed). Kept as its own
// composable — rather than inlining fullWidth/setFullWidth directly into every consumer —
// purely so the 'full'/'centered' string vocabulary those consumers (StockSearchBar's
// el-switch active-value/inactive-value, desktop.vue/mobile.vue/AppPinnedSidebar's
// === 'centered' checks) already use didn't all need rewriting to a bare boolean.
export function useContentWidthMode() {
  const { fullWidth, setFullWidth } = useAppTheme()

  return computed<ContentWidthMode>({
    get: () => (fullWidth.value ? 'full' : 'centered'),
    set: next => setFullWidth(next === 'full')
  })
}
