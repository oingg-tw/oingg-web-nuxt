// The parameters that drive the whole site's look — see the comment block at the top
// of main.css for how each combination maps to actual CSS. Casing/values match the real
// bff-ts contract exactly on purpose — no translation layer between what the API sends and
// what's stored here (see useUserTheme.ts for the actual GET/PUT calls, wired in below).
//
// bff-ts contract as of 2026-08-31 (confirmed live with them, replacing an earlier combined
// PUT that no longer exists): GET /users/me/theme returns all three fields together
// ({ mode, accentColor, marketColorConvention }); each has its own separate PUT —
// /users/me/theme/mode, /users/me/theme/accent-color, /users/me/theme/market-color-convention
// — body is just that one field, required. GOLD is live in their accentColor enum and is now
// their own default for never-set accounts (an explicit prior BLUE choice is left alone).
// ACCESSIBLE is live in their marketColorConvention enum too — they only ever store the key,
// #648FFF/#FE6100 stay defined entirely on this side.
//
// `ThemeColor` is a closed set of pre-approved, contrast-verified keys (never an arbitrary
// hex from the backend) — all seven now have real, contrast-verified CSS values for BOTH
// dark and light mode (see main.css's html.dark[data-theme-color='...'] and
// html:not(.dark)[data-theme-color='...'] blocks). RED/GREEN sit in the same hue family as
// this app's fixed price-up/down colors (--el-color-danger/success) — accepted as a real
// but non-blocking tradeoff (see main.css's own comment for the reasoning), not excluded.
export type ThemeMode = 'LIGHT' | 'DARK' | 'SYSTEM'
export type ThemeColor = 'GOLD' | 'BLUE' | 'GREEN' | 'PURPLE' | 'ORANGE' | 'RED' | 'TEAL'

// Which color means "price went up" — Taiwan/most of Asia reads red as up, green as down;
// the US/Europe read it the other way round. See main.css's --price-up-color/
// --price-down-color for how components actually consume this — they were never meant to
// hardcode --el-color-danger/success directly for an "up"/"down" class in the first place.
//
// 'ACCESSIBLE' is a third, independent option — not a variant of ASIA or WESTERN — built
// from docs/色盲友善股票介面設計.md's recommended IBM blue/orange pair (also independently
// recommended in docs/Dark-Mode Homepage Design Guide .md for the same CVD reasons; Bloomberg
// uses the same blue/red-family swap in its own CVD mode). Deliberately its own palette
// rather than a config of ASIA/WESTERN's red/green, since no amount of red/green retuning
// clears the red-green confusion line for protanopia/deuteranopia (~8% of men) — see that
// doc's "混淆線" section. Contrast re-verified against this app's actual dark surfaces
// (#121212/#1e1e1e/#2a2a2a, not the doc's own #131722 reference bg) — both colors clear
// 4.5:1 (AA normal text) against page and card, and 3:1 (AA UI/large text) against overlay.
export type MarketConvention = 'ASIA' | 'WESTERN' | 'ACCESSIBLE'

const DEFAULT_MODE: ThemeMode = 'DARK'
const DEFAULT_COLOR: ThemeColor = 'GOLD'
const DEFAULT_MARKET: MarketConvention = 'ASIA'

function resolveMode(mode: ThemeMode, prefersDark: boolean): 'LIGHT' | 'DARK' {
  return mode === 'SYSTEM' ? (prefersDark ? 'DARK' : 'LIGHT') : mode
}

// One year — deliberately long-lived. This cookie is what lets a refresh render the right
// theme immediately server-side (see the useHead() call below); it holds only which
// pre-approved enum key was picked, nothing sensitive, so a long expiry has no real downside.
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

// Cookie-backed (not useState) and isomorphic — the whole reason for this is that a cookie
// rides along with the very first server-rendered request, so useHead() below can render the
// CORRECT html attributes in the SSR response itself, before any client JS runs. useState's
// defaults would only ever be right for a guest; every signed-in refresh would render wrong
// defaults first and visibly flip once the client-side GET resolved (this was a real reported
// bug — the flash was especially bad on slow networks/devices, looked broken). A cookie set
// once (on sign-in sync, or on every local change) makes every subsequent request — including
// a hard refresh — start correct with no round-trip and no flash.
export function useAppTheme() {
  const mode = useCookie<ThemeMode>('theme-mode', { default: () => DEFAULT_MODE, maxAge: COOKIE_MAX_AGE, sameSite: 'lax' })
  const color = useCookie<ThemeColor>('theme-color', { default: () => DEFAULT_COLOR, maxAge: COOKIE_MAX_AGE, sameSite: 'lax' })
  const market = useCookie<MarketConvention>('theme-market', { default: () => DEFAULT_MARKET, maxAge: COOKIE_MAX_AGE, sameSite: 'lax' })
  // Only matters once mode is actually 'SYSTEM' — DEFAULT_MODE is 'DARK', so this dummy
  // server-side guess never causes a real mismatch; onMounted below corrects it before
  // resolvedMode would ever need it to reflect something other than DEFAULT_MODE.
  const prefersDark = useState('app-theme-prefers-dark', () => true)
  // Guards the matchMedia listener + currentUser watcher so they start once per app — first
  // component to mount this, not once per every component that calls useAppTheme() — same
  // pattern as useSystemHealth's own polling-interval guard.
  const applying = useState('app-theme-applying-started', () => false)
  // Guards the server-preference fetch below the same way — once per session, not once per
  // component, and never re-fetched just because currentUser happens to re-emit.
  const syncedFromServer = useState('app-theme-synced-from-server', () => false)

  const currentUser = useCurrentUser()
  const { fetchTheme, putMode, putAccentColor, putMarketColorConvention } = useUserTheme()

  const resolvedMode = computed(() => resolveMode(mode.value, prefersDark.value))

  // Runs on both server and client (unlike the onMounted block below) — this is what actually
  // renders the right theme into the SSR HTML from the cookie, no client JS required for
  // first paint to be correct. Safe to call from every useAppTheme() consumer: every call
  // reads the same cookie-backed refs, so redundant registrations just resolve to the same
  // values rather than fighting each other.
  useHead({
    htmlAttrs: {
      class: computed(() => (resolvedMode.value === 'DARK' ? 'dark' : '')),
      'data-theme-color': color,
      'data-market': market
    }
  })

  onMounted(() => {
    if (applying.value) return
    applying.value = true

    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    prefersDark.value = mql.matches
    mql.addEventListener('change', event => {
      prefersDark.value = event.matches
    })

    // Once, the first time a signed-in user is known — not on every auth-state change, and
    // never for a guest (fetchTheme itself no-ops without a token, but checking here first
    // avoids the pointless call). An account's saved preference intentionally overrides
    // whatever this device was showing pre-login (matches how the rest of this app treats
    // signed-in state as the source of truth over local/guest state).
    watch(
      currentUser,
      async user => {
        if (import.meta.dev) {
          console.log(`[app-theme] currentUser watcher fired: ${user ? `signed in (${user.uid})` : 'signed out'}, syncedFromServer=${syncedFromServer.value}`)
        }
        if (!user || syncedFromServer.value) return
        syncedFromServer.value = true
        const remote = await fetchTheme()
        if (import.meta.dev) console.log('[app-theme] GET /users/me/theme returned:', remote)
        if (!remote) return
        // A field can come back null/undefined if the account never set it (e.g.
        // marketColorConvention before this control existed) — never let that stomp the
        // local default with an invalid value.
        if (remote.mode) mode.value = remote.mode
        if (remote.accentColor) color.value = remote.accentColor
        if (remote.marketColorConvention) market.value = remote.marketColorConvention
        if (import.meta.dev) console.log(`[app-theme] applied from server: mode=${mode.value} color=${color.value} market=${market.value}`)
      },
      { immediate: true }
    )
  })

  // Applies locally first (synchronous, so the UI never waits on the network for its own
  // theme change), then persists in the background if signed in — a failed PUT here leaves
  // this device showing the right thing regardless, just unsaved to the account until the
  // next successful sync (see useUserTheme.ts's own warn() for why this doesn't surface a
  // toast).
  function setMode(next: ThemeMode) {
    mode.value = next
    if (currentUser.value) putMode(next)
  }

  function setColor(next: ThemeColor) {
    color.value = next
    if (currentUser.value) putAccentColor(next)
  }

  function setMarket(next: MarketConvention) {
    market.value = next
    if (currentUser.value) putMarketColorConvention(next)
  }

  return { mode, color, market, resolvedMode, setMode, setColor, setMarket }
}
