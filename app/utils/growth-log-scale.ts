// 年增率畫成「是去年的幾倍」的對數（2026-10-21，使用者看 5314 世紀月營收：「歷史有一個月月營收年增率突破天際…用log嗎」，真資料方案頁
// 選了 A）：柱高＝log10(1＋年增率／100)，刻度標回百分比。翻倍（+100%）與腰斬（−50%）一樣高，+49,675% 也畫得下；2330 這種
// −15%～+68% 的公司看起來跟一般刻度差不多。StockMultiSeriesLineChart 的 growthLog 序列用，刻度由 scripts/check-growth-log-scale.mjs 驗。
// 這個檔不 import 任何東西（腳本直接讀它）。

// 最多畫到 −99%（×0.01）：營收 0（−100%）沒有倍數，跟更小的倍數一起畫在最底
export const GROWTH_LOG_FLOOR = -2

// 範圍窄時從這些常見倍數挑刻度（−99%、−90%、−80%、−50%、−33%、−20%、0%、+25%、+50%、+100%、+400%、+900%、+9,900%）
const NARROW_TICKS = [0.01, 0.1, 0.2, 0.5, 2 / 3, 0.8, 1, 1.25, 1.5, 2, 5, 10, 100].map(Math.log10)
const EPSILON = 1e-9

export function growthLogValue(changePct: number): number {
  const ratio = 1 + changePct / 100
  return ratio <= 0 ? GROWTH_LOG_FLOOR : Math.max(GROWTH_LOG_FLOOR, Math.log10(ratio))
}

// 刻度（由下到上，也是軸的上下限）：跨兩個 10 倍以上就 10 倍一格，窄的從常見倍數挑剛好包住資料的那幾個。一定包含 0%，
// 至少 −20%～+25%，全部持平也畫得出一段軸
export function growthLogTicks(changes: number[]): number[] {
  const logs = changes.map(growthLogValue)
  const lo = Math.min(Math.log10(0.8), ...logs)
  const hi = Math.max(Math.log10(1.25), ...logs)
  if (hi - lo >= 2) {
    const from = Math.floor(lo + EPSILON)
    return Array.from({ length: Math.ceil(hi - EPSILON) - from + 1 }, (_, i) => from + i)
  }
  const from = Math.max(...NARROW_TICKS.filter(tick => tick <= lo + EPSILON))
  const to = Math.min(...NARROW_TICKS.filter(tick => tick >= hi - EPSILON))
  return NARROW_TICKS.filter(tick => tick >= from - EPSILON && tick <= to + EPSILON)
}

export function growthLogLabel(tick: number): string {
  const change = Math.round((10 ** tick - 1) * 100)
  if (change === 0) return '0%'
  const digits = String(Math.abs(change)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${change > 0 ? '+' : '-'}${digits}%`
}
