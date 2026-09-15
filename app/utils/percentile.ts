// Shared by every card that renders a 摘要層量尺 (percentile gauge, 卡片軌元件選型規範 2.4.1) —
// linear-interpolation percentile VALUE (e.g. "what's the p20 threshold") and percentile RANK via
// count-at-or-below (e.g. "where does this value rank"). Extracted 2026-09-15 out of
// StockValuationRiverChart.vue, the first adopter, so every later gauge card computes its own
// GaugeStats off the same two functions instead of re-deriving them.
export function percentileValue(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(idx)
  const upper = Math.ceil(idx)
  if (lower === upper) return sorted[lower]!
  const weight = idx - lower
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight
}

export function percentileRank(sorted: number[], value: number): number {
  const countAtOrBelow = sorted.filter(v => v <= value).length
  return (countAtOrBelow / sorted.length) * 100
}

// Shared shape for every SharedPercentileGaugeExpand.vue instance's underlying stats — pulled out
// alongside the 2nd/3rd adopter (StockEvMultiplesCard.vue, StockYieldFamilyCard.vue) once the
// exact same "sort the window's values, need ≥2 distinct ones, derive min/p20/p80/max/rank"
// boilerplate started repeating per metric, per card.
export interface GaugeStats {
  min: number
  p20: number
  p80: number
  max: number
  current: number
  currentPercentile: number
}

// Requires ≥2 distinct values in the window — a gauge over a single point or a flat series has
// no real distribution to place anything within.
export function computeGaugeStats(values: number[], current: number | null): GaugeStats | null {
  const sorted = values.slice().sort((a, b) => a - b)
  if (sorted.length < 2 || current === null) return null
  const min = sorted[0]!
  const max = sorted[sorted.length - 1]!
  if (max <= min) return null
  return { min, max, p20: percentileValue(sorted, 20), p80: percentileValue(sorted, 80), current, currentPercentile: percentileRank(sorted, current) }
}

// Which of the 3 bands the current value falls in — purely descriptive (2.4.3: objective
// statistical-percentile wording only, never "便宜/合理/昂貴" or any evaluative label).
export function gaugeBandLabel(stats: GaugeStats): string {
  if (stats.current <= stats.p20) return '最低20%區間'
  if (stats.current >= stats.p80) return '最高20%區間'
  return '中間60%區間'
}
