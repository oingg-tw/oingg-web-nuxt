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

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)]
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h /= 6
  }
  return [h * 360, s * 100, l * 100]
}

function hexToHsl(hex: string): [number, number, number] {
  return rgbToHsl(...hexToRgb(hex))
}

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360
  s /= 100
  l /= 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let [r, g, b] = [0, 0, 0]
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

// Shortest-path hue interpolation — e.g. red 0° -> green 120° goes through 60° gold, not the
// long way around through 300° magenta/purple. Same effect the original hand-picked river
// palette's own comment described ("mid-point lands on a clean gold, not a muddy RGB-lerp
// brown"), just computed from whichever two colors are actually in play now instead of a
// fixed red/green pair.
function lerpHsl(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  let diff = b[0] - a[0]
  if (diff > 180) diff -= 360
  if (diff < -180) diff += 360
  return [a[0] + diff * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

// Highest valuation multiple (most "expensive") gets the up color, lowest (most "cheap")
// gets the down color — under the app's default ASIA convention that reproduces the
// original red-high/green-low look exactly; under WESTERN it flips, same as every other
// up/down color in the app switches together.
//
// bandCount is the number of VISIBLE filled bands (StockValuationRiverChart.vue: 5, per direct
// request "河道請幫我分五條") — there are bandCount+1 boundary lines (the outermost two are the
// river's own top/bottom edge, drawn but not filled past) and bandCount fills between them.
// Originally hardcoded to exactly 5 lines/4 fills; generalized rather than hand-extending a
// 6th line/5th fill pair when the band count changed.
export function riverColors(upHex: string, downHex: string, bandCount = 4): { lines: string[]; fills: string[] } {
  const downHsl = hexToHsl(downHex)
  const upHsl = hexToHsl(upHex)
  const lineCount = bandCount + 1
  const lines = Array.from({ length: lineCount }, (_, i) => hslToHex(...lerpHsl(downHsl, upHsl, i / (lineCount - 1))))
  // Fill colors sit slightly past each line's own position toward the next one — matching the
  // original hand-picked fills' relationship to their line colors (e.g. line #67c23a's paired
  // fill was #84c737, biased toward the next line up). Same idea generalized: each fill sits at
  // its band's own midpoint plus a small bias toward the upper (up-colored) end.
  const fills = Array.from({ length: bandCount }, (_, i) => {
    const bandStart = i / bandCount
    const bandEnd = (i + 1) / bandCount
    const bias = (bandEnd - bandStart) * 0.15
    return hslToHex(...lerpHsl(downHsl, upHsl, (bandStart + bandEnd) / 2 + bias))
  })
  return { lines, fills }
}

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
  LIGHT: {
    GOLD: '#997328',
    BLUE: '#2f6bb3',
    GREEN: '#268a55',
    PURPLE: '#7c5fd1',
    ORANGE: '#bc6527',
    RED: '#c23a5e',
    TEAL: '#238888'
  }
}

export function getAccentColor(mode: 'LIGHT' | 'DARK', color: string): string {
  return ACCENT_HEX[mode][color] ?? CHART_ACCENT_GOLD
}
