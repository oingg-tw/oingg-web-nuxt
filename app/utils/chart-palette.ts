// Dark theme: charts render on the card surface (--el-bg-color, #121212).
export const CHART_INK = {
  primary: '#f2f2f2',
  secondary: '#b3b3b3',
  muted: '#7a7a7a',
  gridline: '#2a2a2a',
  baseline: '#4a4a4a'
}

// ECharts tooltips default to a white box, which reads as invisible white-on-white
// against this app's light tooltip text — give them an explicit dark surface instead.
export const CHART_TOOLTIP = {
  backgroundColor: '#1a1a1a',
  borderColor: '#333333'
}

// River chart (河流圖) valuation bands: higher multiple = more red, lower = more green,
// same position convention as the app's price-change colors. Ascending, low -> high band.
// 5 boundary-line colors (HSL-interpolated red<->green so the mid-point lands on a clean
// gold rather than a muddy RGB-lerp brown) and the 4 fill colors for the regions between them.
export const CHART_RIVER_LINES = ['#67c23a', '#a3cb35', '#d2bb31', '#d97b2d', '#e0332a']
export const CHART_RIVER_FILLS = ['#84c737', '#c5cf33', '#d69d2f', '#dd582c']

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
