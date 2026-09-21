// 字型大小 — added 2026-09-16 per direct request, alongside
// docs/0_researches/數位無障礙文字縮放標準與字級階層工程實施規範.md (oingg-conductor-ts). That
// research doc's own conclusion: a custom scale control is WCAG Technique G178, not the
// recommended path (browser-native zoom, Technique G142, is).
//
// Re-scoped 2026-09-17 per direct request, after being shown 通傳會 (NCC)'s own 網站無障礙規範
// 2.0 版 PDF — that government standard's own reference implementation uses a modest 3-step
// text-size widget (16px/17.6px/19.2px, ~10% per step, topping out at 120%), NOT an attempt to
// make its own in-page control reach 200% on its own. That's the correct reading of WCAG 1.4.4
// (Resize Text)'s own "up to 200%" requirement: it's satisfied by NOT blocking the BROWSER's own
// native zoom (this app already doesn't — no viewport `maximum-scale`/`user-scalable=no` lock,
// confirmed in nuxt.config.ts's own meta tag), not by a site's own custom widget re-implementing
// that 200% itself. The earlier version of this file (see git history) had it backwards — treating
// 100/150/200 as this control's own mandatory range, which is what produced nearly every layout
// bug fixed today (el-menu padding, tabs overflow, chart fonts, el-select clipping, all only
// appearing because the custom control itself was being pushed to 2x). Matching the government's
// own 100%/110%/120% range keeps this control as the supplementary G178 convenience it's actually
// meant to be, while genuine 200% stays the browser's own job (G142), which was never blocked.
export type TextScale = '100' | '110' | '120'

// Old cookies may still hold values from the earlier 5-step (100/125/150/175/200) or 3-step
// (100/150/200) ranges — normalized to the nearest new step on read (see normalizeScale below)
// rather than left to silently fall outside the current union type.
const LEGACY_SCALE_MAP: Record<string, TextScale> = {
  '125': '110',
  '150': '110',
  '175': '120',
  '200': '120'
}

const DEFAULT_SCALE: TextScale = '100'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

// Element Plus's own size tiers (small/default/large) — mapped 1:1 to this control's own 3 steps
// purely for component-chrome padding/min-height consistency (see el-config-provider's own usage
// in app.vue), same reasoning as before this file's re-scope: it's a density/spacing knob, not
// what makes text bigger (that's still the html[data-text-scale] rem cascade in main.css).
const SCALE_TO_EL_SIZE: Record<TextScale, 'small' | 'default' | 'large'> = {
  '100': 'small',
  '110': 'default',
  '120': 'large'
}

function normalizeScale(value: string): TextScale {
  if (value === '100' || value === '110' || value === '120') return value
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
