// 年增率畫成「是去年的幾倍」的對數（2026-10-21，使用者看 5314 世紀月營收：「歷史有一個月月營收年增率突破天際…用log嗎」，真資料方案頁
// 選了 A）：柱高＝log10(1＋年增率／100)，刻度標回百分比。翻倍（+100%）與腰斬（−50%）一樣高，+49,675% 也畫得下；2330 這種
// −15%～+68% 的公司看起來跟一般刻度差不多。StockMultiSeriesLineChart 的 growthLog 序列用，刻度由 scripts/check-growth-log-scale.mjs 驗。
// 這個檔不 import 任何東西（腳本直接讀它）。

// 最多畫到 −99%（×0.01）：營收 0（−100%）沒有倍數，跟更小的倍數一起畫在最底
export const GROWTH_LOG_FLOOR = -2

// 指標頁與指標速覽的柱狀圖用這種刻度的指標（使用者：「其他年增率柱狀圖要一起改」）：母數不會是負的（營收、總資產），「是去年的幾倍」
// 才有意義、也不會低於 −100%。每股盈餘、淨利、營業利益、營業現金流會虧損——上游的年增率分母是 |去年同期|，去年虧損時算出來的不是
// 倍數，還會低於 −100%，所以照一般刻度。淨值、每股淨值極少數公司是負的，也不放
export const GROWTH_LOG_METRICS: ReadonlySet<string> = new Set(['revenueGrowthRate', 'revenueYoy3m', 'assetGrowth'])

// 刻度分三級，挑剛好包住資料的那幾個：跨兩個 10 倍以上每 10 倍一格；一到兩個 10 倍用 1、2、5 倍（−50%、0%、+100%、+400%、+900%、
// +1,900%…）；更窄用常見的百分比（−20%、0%、+25%、+50%…）。2026-10-21 5314 營收成長年增率（−10%～+2,000%）原本用細刻度、軸又
// 一路拉到 ×100，底下的字疊在一起、上面空一大段
const STEP_TICKS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100].map(Math.log10)
const FINE_TICKS = [0.2, 0.5, 2 / 3, 0.8, 1, 1.25, 1.5, 2, 5].map(Math.log10)
const FINE_SPAN = 0.6
const EPSILON = 1e-9

export function growthLogValue(changePct: number): number {
  const ratio = 1 + changePct / 100
  return ratio <= 0 ? GROWTH_LOG_FLOOR : Math.max(GROWTH_LOG_FLOOR, Math.log10(ratio))
}

// 刻度（由下到上，也是軸的上下限）。一定包含 0%，至少 −20%～+25%，全部持平也畫得出一段軸
export function growthLogTicks(changes: number[]): number[] {
  const logs = changes.map(growthLogValue)
  const lo = Math.min(Math.log10(0.8), ...logs)
  const hi = Math.max(Math.log10(1.25), ...logs)
  if (hi - lo >= 2) {
    const from = Math.floor(lo + EPSILON)
    return Array.from({ length: Math.ceil(hi - EPSILON) - from + 1 }, (_, i) => from + i)
  }
  const candidates = hi - lo <= FINE_SPAN ? FINE_TICKS : STEP_TICKS
  const from = Math.max(...candidates.filter(tick => tick <= lo + EPSILON))
  const to = Math.min(...candidates.filter(tick => tick >= hi - EPSILON))
  return candidates.filter(tick => tick >= from - EPSILON && tick <= to + EPSILON)
}

// ECharts 值軸的設定，兩支圖表共用（StockMultiSeriesLineChart、useMetricHistoryChartOption）：刻度就是上下限，刻度字標回百分比。
// 格線不畫：customValues 不會帶到 splitLine，格線會跟刻度錯開
export function growthLogAxis(changes: number[]) {
  const ticks = growthLogTicks(changes)
  return { min: ticks[0], max: ticks.at(-1), axisLabel: { customValues: ticks, formatter: growthLogLabel }, axisTick: { customValues: ticks }, splitLine: { show: false } }
}

export function growthLogLabel(tick: number): string {
  const change = Math.round((10 ** tick - 1) * 100)
  if (change === 0) return '0%'
  const digits = String(Math.abs(change)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${change > 0 ? '+' : '-'}${digits}%`
}
