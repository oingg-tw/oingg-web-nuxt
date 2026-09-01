// Dark theme: charts render on the card surface (--el-bg-color, #1e1e1e).
// `muted` is used as real axisLabel text (fontSize 11, below the WCAG "large text"
// cutoff), so it must clear the 4.5:1 AA text ratio against that surface, not just the
// 3:1 non-text ratio. Re-verify this whenever --el-bg-color changes — a *lighter* card
// surface pulls contrast *down* for a fixed mid-grey, same as it dropped when the
// surface moved #121212 → #1e1e1e here (#808080 fell from 4.74:1 to 4.22:1, under the
// floor again). #888888 clears 4.70:1 against #1e1e1e.
export const CHART_INK = {
  primary: '#f2f2f2',
  secondary: '#b3b3b3',
  muted: '#888888',
  gridline: '#2a2a2a',
  baseline: '#4a4a4a'
}

// ECharts tooltips default to a white box, which reads as invisible white-on-white
// against this app's light tooltip text — give them an explicit dark surface instead.
export const CHART_TOOLTIP = {
  backgroundColor: '#1a1a1a',
  borderColor: '#333333'
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
export function riverColors(upHex: string, downHex: string): { lines: string[]; fills: string[] } {
  const downHsl = hexToHsl(downHex)
  const upHsl = hexToHsl(upHex)
  const lines = [0, 0.25, 0.5, 0.75, 1].map(t => hslToHex(...lerpHsl(downHsl, upHsl, t)))
  // Fill colors sit slightly past each line's own position toward the next one — matching
  // the original hand-picked fills' relationship to their line colors (e.g. line #67c23a's
  // paired fill was #84c737, biased toward the next line up).
  const fills = [0.15, 0.4, 0.65, 0.9].map(t => hslToHex(...lerpHsl(downHsl, upHsl, t)))
  return { lines, fills }
}

// Diverging pair for above/below-baseline bars, matching the app's TW-convention
// price colors (red = up/positive, green = down/negative) rather than the brand hues.
export const CHART_DIVERGING = {
  positive: '#e0332a',
  negative: '#67c23a',
  neutral: '#4a4a4a'
}

// Brand gold, matching --el-color-primary — for plain-magnitude bars (e.g. revenue)
// that don't need a diverging/semantic color, since ECharts options can't read CSS vars.
export const CHART_ACCENT_GOLD = '#d4a72c'
