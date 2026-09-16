// 字型大小 — added 2026-09-16 per direct request, alongside
// docs/0_researches/數位無障礙文字縮放標準與字級階層工程實施規範.md (oingg-conductor-ts). That
// research doc's own conclusion: a custom scale control is WCAG Technique G178, not the
// recommended path (browser-native zoom, Technique G142, is) — but if a team builds one anyway,
// it must genuinely reach 200% and cover ALL text on the page (nav, forms, sidebars included),
// not just body copy, or it's a compliance failure, not a feature.
//
// That "cover all text" requirement is why this app-wide px→rem conversion happened THE SAME DAY
// (193 replacements across 52 files, plus --el-font-size-base/--el-font-size-extra-small in
// main.css) before this composable was even written — every font-size in this codebase used to
// be a literal px value, which a root font-size change has zero effect on (rem is relative to
// the ROOT element's font-size specifically, unlike em's relative-to-parent behavior — that's
// exactly why rem, not em, is what lets one root-level change cascade to every component
// regardless of nesting depth). With every font-size now in rem, scaling <html>'s own font-size
// scales literally all of them at once, satisfying G178's coverage requirement without hunting
// down page-specific exceptions.
//
// Simplified 5→3 steps 2026-09-16 per direct request ("字型大小 只保留三階級，對應到element plus
// 預設的 small default large") — reaching a REAL 200% at the top end still holds (100/150/200,
// not the "16/18/20px" ~125%-only pattern the research doc calls out by name as non-compliant),
// just with coarser steps. Each step also still maps directly to a real Element Plus component
// size tier via `elSize` below, which is the actual point of the simplification: 3 steps means 3
// tiers, no in-between value that would have no corresponding native tier to hand to
// <el-config-provider :size>.
export type TextScale = '100' | '150' | '200'

// Old cookies may still hold '125'/'175' from before this change — normalized to the nearest new
// step on read (see readScale below) rather than left to silently fall outside the new union type.
const LEGACY_SCALE_MAP: Record<string, TextScale> = { '125': '150', '175': '200' }

// Default changed 100→150 2026-09-16 per direct request ("我們預設改用medium字級就好，我看很多
// 網站也是這樣做") — 150% is this scale's own middle step (maps to Element Plus's `default` size
// tier, not `small`), landing new visitors on a more comfortably-readable starting size instead
// of the smallest one, matching the common "don't default to the tightest density" convention on
// other sites. Existing cookies already holding an explicit '100'/'200' are untouched — this only
// changes what a first-time visitor with no cookie yet sees.
const DEFAULT_SCALE: TextScale = '150'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

// Element Plus's own size tiers (small/default/large) only span ~12→14px font-size — nowhere
// near a real 200% on their own (confirmed live 2026-09-16: --el-font-size-base is 14px even at
// the large tier for inputs/selects). So this does NOT replace the html[data-text-scale] rem
// cascade in main.css, which is what actually makes text reach genuine 200% — it runs alongside
// it. What `elSize` buys instead is PADDING/MIN-HEIGHT consistency: Element Plus's own per-tier
// CSS keeps a component's internal spacing correctly matched to that tier's own dimensions (that
// relationship is what today's whack-a-mole bugs kept breaking — e.g. the tab nav-arrow width
// growing without its reserved padding growing to match, since our override changed one hardcoded
// property but not the other one Element Plus's own CSS assumes moves with it). Handing the whole
// tier to Element Plus via el-config-provider means its own internally-consistent CSS handles
// that relationship, instead of us hunting down each hardcoded pairing by hand.
const SCALE_TO_EL_SIZE: Record<TextScale, 'small' | 'default' | 'large'> = {
  '100': 'small',
  '150': 'default',
  '200': 'large'
}

function normalizeScale(value: string): TextScale {
  if (value === '100' || value === '150' || value === '200') return value
  return LEGACY_SCALE_MAP[value] ?? DEFAULT_SCALE
}

// Cookie-backed + useHead htmlAttrs, same SSR-correctness pattern useAppTheme.ts already
// established for mode/color/market — a client-only ref would flash back to 100% on every
// refresh until hydration re-applied the real value, which is a much more jarring layout jump
// for a text-SIZE setting than it ever was for a color change.
export function useTextScale() {
  const rawScale = useCookie<string>('text-scale', { default: () => DEFAULT_SCALE, maxAge: COOKIE_MAX_AGE, sameSite: 'lax' })
  const scale = computed<TextScale>(() => normalizeScale(rawScale.value))
  const elSize = computed(() => SCALE_TO_EL_SIZE[scale.value])

  useHead({
    htmlAttrs: {
      'data-text-scale': scale
    }
  })

  function setScale(value: TextScale) {
    rawScale.value = value
  }

  return { scale, setScale, elSize }
}
