// Unified 近1/2/3/5/8年 lookback-window scale for every stock-detail chart card, replacing the
// former 近5年/近10年 two-option pattern — per direct request 2026-09-14 ("所有卡片的時間下拉選單
// 統一 近 1 2 3 5 8年"). Auto-imported (app/utils convention, same as getChartInk/CHART_TOOLTIP
// etc.), so no explicit import needed at call sites.
export const LOOKBACK_WINDOW_YEARS = {
  近1年: 1,
  近2年: 2,
  近3年: 3,
  近5年: 5,
  近8年: 8
}

export type LookbackWindow = '近1年' | '近2年' | '近3年' | '近5年' | '近8年'

export const LOOKBACK_YEARS = [1, 2, 3, 5, 8] as const
