// The wide-viewport (≥1280px) signal. It USED to pick the whole layout — app.vue chose between
// layouts/desktop.vue and layouts/mobile.vue from it — until 2026-09-19, when the two were merged
// into one CSS-driven layouts/default.vue (see its own comment: the cookie-seeded guess was wrong
// for every cookie-less first visit and re-mounted the page after hydration). It is now only a
// client-side hint for things CSS can't do, e.g. StockPageNav.vue teleporting the 個股頁面 links
// into the desktop rail; the SSR/first-render value still comes from the cookie so nothing here
// ever causes a hydration mismatch, and the real matchMedia value is applied after hydration.
//
// Cookie-backed (not a bare ref) for the same reason useAppTheme.ts's mode/color/market
// are: a bare ref always starts `false` (mobile, no sidebar) on both SSR and the client's
// first paint, matchMedia only running after hydration — so on every actual-desktop reload the
// mobile shell rendered first and then swapped to the desktop shell with its 240px pinned
// sidebar once mounted, visibly pushing the whole page over (reported as "sidebar長出來還是
// 會推動畫面" — a skeleton on the page's own content can't fix this, since the shift comes
// from the shell around it, not the content). Caching the last known value in a cookie lets
// SSR render the right shell immediately on a returning visit, matching the theme fix's
// approach. The cookie is ONLY that SSR seed now (see below) — never the live value.
//
// Real bug fixed 2026-09-16 (reported live: "切到手機板會跳出桌機板的 app-pinned-sidebar", with a
// screenshot whose geometry pinned the state down exactly: the content column was ~90px wide,
// which is what desktop.vue's own `padding-left: 240px + 16px` leaves behind at a ~365px
// viewport, while the summary card was simultaneously rendering its `@media (max-width: 600px)`
// mobile styles — i.e. the viewport was genuinely phone-width while `isWide` was still true, so
// the DESKTOP shell was mounted on a phone-width window).
//
// Root cause: this composable's entire correction path used to live inside `onMounted` +
// `onUnmounted` of whichever component happened to call it. That made the app's global layout
// decision depend on one component's lifecycle timing — if that hook didn't run, or its listener
// was torn down, `isWide` silently kept serving the STALE COOKIE value (true, from the user's
// earlier wide-window session) forever, even as the window shrank. The fragility got much easier
// to trip the same day, when two more call sites were added (StockExperienceModeSelect.vue and
// StockDetailActions.vue, both for hiding desktop-only controls on mobile): those render inside
// StockSummaryCard's `#actions` slot, which is invoked TWICE (full card + the scroll-triggered
// sticky bar), so a single stock page could have ~5 instances each registering and removing
// their own matchMedia listener as the sticky bar and tabs mounted/unmounted.
//
// Fix: the listener is now installed exactly ONCE per page load, at module scope, and is never
// removed — the app itself never unmounts, so there is no lifecycle event that can legitimately
// strip the app's own layout listener. Every call site shares one `useState` instead of each
// holding its own independent `useCookie` ref, so they can't drift apart either. Installed via
// onNuxtReady (not onMounted) for two reasons: it needs no component instance at all, which is
// what removes the lifecycle coupling; and it runs only after hydration finishes, which preserves
// the original no-hydration-mismatch property (server and client both render from the cookie
// seed, and the real matchMedia value is only applied afterwards).
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365
const WIDE_LAYOUT_QUERY = '(min-width: 1280px)'

// Client-only, per page load (module state resets on a full reload, and `import.meta.client`
// keeps the server from ever touching it — module scope IS shared across requests there).
let listenerInstalled = false

export function useIsWideLayout() {
  // SSR seed only — read once to initialise the shared state below, then written on each real
  // breakpoint change so the NEXT server render of this browser starts from the right shell.
  const seedCookie = useCookie<boolean>('layout-wide', { default: () => false, maxAge: COOKIE_MAX_AGE, sameSite: 'lax' })
  // The live value every call site shares. Initialised from the cookie, so SSR and the client's
  // first render agree exactly (useState is serialised into the payload and restored on hydration).
  const isWide = useState<boolean>('layout-is-wide', () => seedCookie.value)

  if (import.meta.client && !listenerInstalled) {
    listenerInstalled = true
    onNuxtReady(() => {
      const mql = window.matchMedia(WIDE_LAYOUT_QUERY)
      function sync() {
        isWide.value = mql.matches
        seedCookie.value = mql.matches
      }
      sync()
      mql.addEventListener('change', sync)
    })
  }

  return isWide
}
