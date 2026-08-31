// The parameters that drive the whole site's look — see the comment block at the top
// of main.css for how each combination maps to actual CSS. Casing/values for mode/color
// match the real bff-ts contract exactly (GET/PUT /users/me/theme, confirmed 2026-08-31) on
// purpose — no translation layer between what the API sends and what's stored here, so
// wiring the actual fetch later is a straight passthrough.
//
// `ThemeColor` is a closed set of pre-approved, contrast-verified keys (never an arbitrary
// hex from the backend). Only 'GOLD' and 'BLUE' have real CSS values defined so far (see
// main.css) — GREEN/PURPLE/ORANGE/RED/TEAL exist here because the backend's enum already
// includes them, but selecting one today just falls through to Element Plus's own
// unthemed default color until each gets its own verified palette (and, for RED/GREEN
// specifically, a decision on how to avoid clashing with the fixed price-up/down colors —
// see MarketConvention below — deliberately not decided yet).
export type ThemeMode = 'LIGHT' | 'DARK' | 'SYSTEM'
export type ThemeColor = 'GOLD' | 'BLUE' | 'GREEN' | 'PURPLE' | 'ORANGE' | 'RED' | 'TEAL'

// Which color means "price went up" — Taiwan/most of Asia reads red as up, green as down;
// the US/Europe read it the other way round. This has nothing to do with ThemeMode/Color
// above (it's not a bff-ts field yet, just a local preference), but it's still "how the
// whole site looks" in the same sense, so it lives in this same composable rather than a
// separate one. See main.css's --price-up-color/--price-down-color for how components
// actually consume this — they were never meant to hardcode --el-color-danger/success
// directly for an "up"/"down" class in the first place.
export type MarketConvention = 'ASIA' | 'WESTERN'

const DEFAULT_MODE: ThemeMode = 'DARK'
const DEFAULT_COLOR: ThemeColor = 'GOLD'
const DEFAULT_MARKET: MarketConvention = 'ASIA'

function resolveMode(mode: ThemeMode, prefersDark: boolean): 'LIGHT' | 'DARK' {
  return mode === 'SYSTEM' ? (prefersDark ? 'DARK' : 'LIGHT') : mode
}

function applyToDocument(resolvedMode: 'LIGHT' | 'DARK', color: ThemeColor, market: MarketConvention) {
  document.documentElement.classList.toggle('dark', resolvedMode === 'DARK')
  document.documentElement.dataset.themeColor = color
  document.documentElement.dataset.market = market
}

// Shared across every consumer (useState, not a bare module-level ref — a bare ref would
// leak between concurrent users' SSR requests, since a Nuxt server process reuses the same
// module instance across requests). nuxt.config.ts's own htmlAttrs render these exact
// defaults server-side, so mounting this composable is a no-op until something actually
// calls setMode/setColor/setMarket with a different value (e.g. once GET /users/me/theme is
// actually wired in) — there's no flash-of-wrong-theme on first load either way.
export function useAppTheme() {
  const mode = useState<ThemeMode>('app-theme-mode', () => DEFAULT_MODE)
  const color = useState<ThemeColor>('app-theme-color', () => DEFAULT_COLOR)
  const market = useState<MarketConvention>('app-theme-market', () => DEFAULT_MARKET)
  // Only matters once mode is actually 'SYSTEM' — DEFAULT_MODE is 'DARK', so this dummy
  // server-side guess never causes a real mismatch; onMounted below corrects it before
  // resolvedMode's watcher would ever need it to reflect something other than DEFAULT_MODE.
  const prefersDark = useState('app-theme-prefers-dark', () => true)
  // Guards the DOM-syncing watcher (and the matchMedia listener) so they start once per app
  // — first component to mount this, not once per every component that calls
  // useAppTheme() — same pattern as useSystemHealth's own polling-interval guard.
  const applying = useState('app-theme-applying-started', () => false)

  const resolvedMode = computed(() => resolveMode(mode.value, prefersDark.value))

  onMounted(() => {
    if (applying.value) return
    applying.value = true

    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    prefersDark.value = mql.matches
    mql.addEventListener('change', event => {
      prefersDark.value = event.matches
    })

    watch([resolvedMode, color, market], ([m, c, mk]) => applyToDocument(m, c, mk), { immediate: true })
  })

  function setMode(next: ThemeMode) {
    mode.value = next
  }

  function setColor(next: ThemeColor) {
    color.value = next
  }

  function setMarket(next: MarketConvention) {
    market.value = next
  }

  return { mode, color, market, resolvedMode, setMode, setColor, setMarket }
}
