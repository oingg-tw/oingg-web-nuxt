// ECharts tooltips default to a white box, which reads as invisible white-on-white
// against this app's light tooltip text — give them an explicit dark surface instead,
// UNCONDITIONALLY regardless of the site's own light/dark theme (a floating tooltip
// looks the same in both — this was a deliberate, independent design choice, not an
// oversight to theme-match later).
export const CHART_TOOLTIP = {
  backgroundColor: '#1a1a1a',
  borderColor: '#333333'
}

// Text/line colors for INSIDE the tooltip only, drawn on CHART_TOOLTIP's own fixed dark
// surface above — correct in both light and dark site themes because that surface itself
// never changes. NOT for anything drawn directly on the chart/card's own surface (axis
// labels, gridlines, data lines) — those need getChartInk() below instead, which DOES
// track the site theme. #888888 clears 4.70:1 against #1e1e1e (this box's own bg);
// #b3b3b3 clears 7.95:1; #f2f2f2 clears 14.89:1.
export const CHART_TOOLTIP_INK = {
  primary: '#f2f2f2',
  secondary: '#b3b3b3',
  muted: '#888888'
}

// Everything drawn directly on the chart/card's own surface — axis labels/lines,
// gridlines, and any data-line color that isn't semantically tied to price direction or
// the user's accent choice (e.g. StockDupontChart.vue's dashed 淨利率 line,
// StockRevenueChart.vue's 年增率 line). Was a single fixed (dark-only) object before
// StockValuationRiverChart.vue/friends started rendering in light mode too — every one of
// `muted`/`gridline`/`baseline` was tuned ONLY against the dark surface (#1e1e1e) and
// left completely uncalibrated for the light one (#faf9f6), which a mid-light grey like
// the old `primary`/`secondary` renders as near-invisible against (reported live:
// "線條顏色 在light mode 是否符合AA 等級" — they didn't, badly). LIGHT values reuse this
// app's own already-AA-audited text-color ladder (main.css's html:not(.dark) block) rather
// than inventing new ones: muted -> --el-text-color-secondary (#66686d, 5.30:1 against
// card), secondary -> Element Plus's own --el-text-color-regular default (#606266, 5.80:1),
// primary -> its own --el-text-color-primary default (#303133, 12.37:1). `muted` is the one
// that matters most for AA: it's used as real axisLabel text (fontSize 11, below the WCAG
// "large text" cutoff), so it must clear 4.5:1, not just the 3:1 non-text floor — both
// modes' `muted` do (dark: 4.70:1 against #1e1e1e; light: 5.30:1 against #faf9f6).
// gridline/baseline are decorative (splitLine/axisLine/axisPointer), so AA text-contrast
// doesn't strictly apply — chosen for the same relative subtlety as the dark values (barely
// visible gridline, a bit more visible baseline) rather than matched to a contrast target.
export function getChartInk(mode: 'LIGHT' | 'DARK'): {
  primary: string
  secondary: string
  muted: string
  gridline: string
  baseline: string
} {
  return mode === 'DARK'
    ? { primary: '#f2f2f2', secondary: '#b3b3b3', muted: '#888888', gridline: '#2a2a2a', baseline: '#4a4a4a' }
    : { primary: '#303133', secondary: '#606266', muted: '#66686d', gridline: '#e8e4da', baseline: '#c9c4b8' }
}

// --- River chart (河流圖) valuation-band colors ---
//
// Dynamically matched to whichever price-up/down colors the user's own market convention
// resolves to (--price-up-color/--price-down-color in main.css), instead of a fixed
// red-low/green-high pair independent of that setting — requested after the two were found
// to disagree under WESTERN convention (river chart still red-high/green-low while every
// other up/down color in the app had flipped). ECharts options are plain JS and can't
// consume CSS custom properties, so getPriceColors below is a manual mirror of main.css's
// own --el-color-danger/--el-color-success (mode-dependent) and ACCESSIBLE resolution chain
// — keep these hex values in sync with main.css whenever those change.
const DANGER_BASE = { light: '#c62828', dark: '#f16862' }
const SUCCESS_BASE = { light: '#1e7e34', dark: '#67c23a' }
const ACCESSIBLE_UP = { light: '#1a53c4', dark: '#648fff' }
const ACCESSIBLE_DOWN = { light: '#a84500', dark: '#fe6100' }

export function getPriceColors(
  mode: 'LIGHT' | 'DARK',
  market: 'ASIA' | 'WESTERN' | 'ACCESSIBLE'
): { up: string; down: string } {
  const modeKey = mode === 'DARK' ? 'dark' : 'light'
  if (market === 'ACCESSIBLE') return { up: ACCESSIBLE_UP[modeKey], down: ACCESSIBLE_DOWN[modeKey] }
  const danger = DANGER_BASE[modeKey]
  const success = SUCCESS_BASE[modeKey]
  return market === 'WESTERN' ? { up: success, down: danger } : { up: danger, down: success }
}

// hexToRgb/rgbToHsl/hexToHsl/hslToHex/lerpHsl and riverColors() lived here until 2026-09-20 —
// ~87 lines of colour-space maths whose only caller was StockValuationRiverChart.vue, deleted in
// the same commit (see that commit message for the orphaned-component sweep and the restore
// point). Nothing else in the app interpolates colours; if a future chart needs a gradient
// palette again, restore from git rather than rewriting it.

// Diverging pair for above/below-baseline bars, matching the app's TW-convention
// price colors (red = up/positive, green = down/negative) rather than the brand hues.
export const CHART_DIVERGING = {
  positive: '#e0332a',
  negative: '#67c23a',
  neutral: '#4a4a4a'
}

// Brand gold, matching --el-color-primary under the DEFAULT (GOLD) accent — for plain-
// magnitude bars/lines (e.g. revenue) that don't need a diverging/semantic color and don't
// need to track the user's own accent-color choice either, since ECharts options can't read
// CSS vars. Prefer getAccentColor() below for anything that SHOULD follow the user's chosen
// accent color (main.css's --el-color-primary changes with it) — kept as a fallback constant
// where a fixed brand color is genuinely the intent.
export const CHART_ACCENT_GOLD = '#d4a72c'

// CHART_ACCENT_GOLD only ever cleared WCAG 1.4.11's 3:1 non-text contrast floor against the
// DARK card surface (7.43:1 @ #1e1e1e) — against the light one it's 2.13:1, a real fail
// (reported live, "希望卡片圖表的線條 在 light mode 也符合 accessbility 標準"), same issue
// StockDupontChart.vue/StockDupontExtendedChart.vue's own fixed line colors had (all tuned only
// against dark, never checked against light). Darkened along the same hue/saturation to
// 3.31:1 against #faf9f6 — same treatment as those two files' own light variants.
export function getChartAccentGold(mode: 'LIGHT' | 'DARK'): string {
  return mode === 'DARK' ? CHART_ACCENT_GOLD : '#aa841f'
}

// Manual mirror of main.css's own html[data-theme-color='...'] --el-color-primary values (one
// per ThemeColor × light/dark) — same "ECharts options are plain JS, can't consume CSS custom
// properties" constraint getPriceColors above already works around. Keep these hex values in
// sync with main.css whenever those change. Used for chart series that should track the
// user's own accent-color choice (e.g. the PE/PB ratio history line — per direct request
// "本益比河流圖的線 那條顏色要跟著網站主題色變動") rather than a fixed brand color.
const ACCENT_HEX: Record<'LIGHT' | 'DARK', Record<string, string>> = {
  DARK: {
    GOLD: '#d6b351',
    BLUE: '#7eb6e8',
    GREEN: '#6bc99a',
    PURPLE: '#bfaae8',
    ORANGE: '#eb9d6b',
    RED: '#ee9baa',
    TEAL: '#5ac8c8'
  },
  // Light values retuned 2026-09-19 to ≥4.5:1 against the page background (see main.css's own
  // light-mode accent comment) — BLUE/RED unchanged, the other five slightly darker.
  LIGHT: {
    GOLD: '#8a6823',
    BLUE: '#2f6bb3',
    GREEN: '#227d4d',
    PURPLE: '#775bc9',
    ORANGE: '#a75a23',
    RED: '#c23a5e',
    TEAL: '#1f7a7a'
  }
}

export function getAccentColor(mode: 'LIGHT' | 'DARK', color: string): string {
  return ACCENT_HEX[mode][color] ?? CHART_ACCENT_GOLD
}
