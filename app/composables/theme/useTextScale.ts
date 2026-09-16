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
// 5 steps (100/125/150/175/200%) reaching a REAL 200% at the top end — not the common "16/18/20px"
// pattern the research doc calls out by name as only reaching ~125%, which it says would be
// judged non-compliant if offered as the only scaling path. Every step also directly maps to a
// browser's own native zoom percentage, so intermediate values need no separate justification.
export type TextScale = '100' | '125' | '150' | '175' | '200'

const DEFAULT_SCALE: TextScale = '100'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

// Cookie-backed + useHead htmlAttrs, same SSR-correctness pattern useAppTheme.ts already
// established for mode/color/market — a client-only ref would flash back to 100% on every
// refresh until hydration re-applied the real value, which is a much more jarring layout jump
// for a text-SIZE setting than it ever was for a color change.
export function useTextScale() {
  const scale = useCookie<TextScale>('text-scale', { default: () => DEFAULT_SCALE, maxAge: COOKIE_MAX_AGE, sameSite: 'lax' })

  useHead({
    htmlAttrs: {
      'data-text-scale': scale
    }
  })

  function setScale(value: TextScale) {
    scale.value = value
  }

  return { scale, setScale }
}
