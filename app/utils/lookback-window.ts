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

// Which windows this symbol cannot fill. Was used to DISABLE those options; now it only marks
// them（2026-09-25,「本來圖表位置讓未付費者看到提示」and the step before it）. A greyed-out option
// says nothing — the reader cannot tell whether the limit is this company's age or our gap, which
// is retiree-01's「你連年數都不給我看，那我就是在賭，我不賭」. Selectable plus an explanation in the
// chart's own place answers that; disabling never can.
export function insufficientLookbackYears(total: number | null): number[] {
  return total === null ? [] : LOOKBACK_YEARS.filter(years => total < years * 4)
}

// The explanation that replaces the chart. Names BOTH numbers, because the reader's real question
// is「是這家公司只有這麼短，還是你們沒給我」— a bare「資料不足」answers neither. The wording is
// deliberately free of any paid-tier hint: this state means the periods DO NOT EXIST, and offering
// to sell them is the failure retiree-03 said he would refund and post publicly over.
export function lookbackShortfallText(window: LookbackWindow, total: number | null): string {
  const needed = LOOKBACK_WINDOW_YEARS[window] * 4
  return total === null
    ? `${window}需要 ${needed} 季的資料`
    : `${window}需要 ${needed} 季，本檔只有 ${total} 季`
}
