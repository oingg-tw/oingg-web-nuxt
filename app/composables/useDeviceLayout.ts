// Single source of truth for the mobile/desktop layout split — app.vue picks between
// layouts/desktop.vue (pinned sidebar) and layouts/mobile.vue (floating Home button +
// modal) based on this, so the breakpoint only ever lives in one place instead of being
// copied into every component that used to care about it.
//
// Cookie-backed (not a bare ref) for the same reason useAppTheme.ts's mode/color/market
// are: a bare ref always starts `false` (mobile, no sidebar) on both SSR and the client's
// first paint, matchMedia only running in onMounted — so on every actual-desktop reload the
// mobile shell rendered first and then swapped to the desktop shell with its 240px pinned
// sidebar once mounted, visibly pushing the whole page over (reported as "sidebar長出來還是
// 會推動畫面" — a skeleton on the page's own content can't fix this, since the shift comes
// from the shell around it, not the content). Caching the last known value in a cookie lets
// SSR render the right shell immediately on a returning visit, matching the theme fix's
// approach. Still defaults to false for a genuinely first-ever visit (no cookie yet) or if
// the window is actually narrower than last time — onMounted below corrects either case,
// same as before, just no longer the common case on repeat visits.
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export function useIsWideLayout() {
  const isWide = useCookie<boolean>('layout-wide', { default: () => false, maxAge: COOKIE_MAX_AGE, sameSite: 'lax' })
  let mql: MediaQueryList | undefined

  function update(event: MediaQueryList | MediaQueryListEvent) {
    isWide.value = event.matches
  }

  onMounted(() => {
    mql = window.matchMedia('(min-width: 1280px)')
    update(mql)
    mql.addEventListener('change', update)
  })

  onUnmounted(() => {
    mql?.removeEventListener('change', update)
  })

  return isWide
}
