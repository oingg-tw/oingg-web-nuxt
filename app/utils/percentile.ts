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

// **跟 percentileValue 互為逆函式**，這是它唯一要成立的性質——量尺把標記直接畫在這個百分位上
// （SharedPercentileGaugeExpand 的 :current），而條的兩端標的是 min／max 的實際值，兩者不互逆的話
// 「等於左端標籤的那個值」不會落在左端。
//
// 2026-09-28 修正。舊版是 `count(≤ value) / n`，值域 (0, 100]——最小值拿到 1/n 而不是 0，所以
// 20 季裡最低的那一季顯示成「第 5 百分位」，而量尺左端就標著它自己的值（使用者指出的就是這個）。
// 更根本的問題是它跟同一個檔案裡的 percentileValue 用了不同慣例：後者的 idx 是 (p/100) × (n−1)，
// 兩端是 0 與 100。實測互逆性——舊版只有最大值對得回去，其餘每一個都差一格；新版四個測試點全中。
//
// 現在的慣例跟 Excel 的 PERCENTRANK.INC 一致：最小值 0、最大值 100、中間線性。
export function percentileRank(sorted: number[], value: number): number {
  // n = 1 沒有分佈可言。computeGaugeStats 本來就要求 ≥2，這個守衛是給其他呼叫端的。
  if (sorted.length < 2) return 0
  const countBelow = sorted.filter(v => v < value).length
  return (countBelow / (sorted.length - 1)) * 100
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
