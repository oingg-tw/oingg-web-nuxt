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

// Which windows this symbol cannot fill.
//
// **2026-09-30 起這些選項是 disabled 的**（直接指示「資料不足的年份就 disabled 不讓選」）。這推翻了
// 2026-09-25 的相反決定，而那個決定的理由——「灰掉的選項什麼都沒說，讀者分不出是公司太年輕還是我們
// 沒給」，也就是 retiree-01 的「你連年數都不給我看，那我就是在賭，我不賭」——**現在由另一條路回答**：
// 2026-09-24 之後每張圖的角落都印著「本站共 N 季（約 M 年）」（見 coverageText）。年數看得到了，
// 灰掉就不再等於藏資訊。
//
// 而且現在讀者根本不會落在填不滿的視窗上：fitLookbackWindow() 會自動往下找得到的最大區間。
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

// 把讀者選的區間收斂成這一檔真的填得滿的最大區間（2026-09-30「預設如果不足五年歷史就往下調整，
// 最小到一年」）。回傳 null 代表連一年都沒有——那時呼叫端不要畫圖，直接說未滿一年。
//
// **收斂而不是覆寫讀者的選擇**：視窗偏好是跨頁共用的 useState，直接改掉會讓「看了一檔淺的、回到
// 深的那一檔也變短」。所以選擇留著，只有渲染時取 min(選擇, 這一檔的上限)。
export function fitLookbackWindow(chosen: LookbackWindow, total: number | null): LookbackWindow | null {
  if (total === null) return chosen
  const fits = LOOKBACK_YEARS.filter(years => years <= LOOKBACK_WINDOW_YEARS[chosen] && total >= years * 4)
  const best = fits[fits.length - 1]
  return best === undefined ? null : (`近${best}年` as LookbackWindow)
}

// 連一年都沒有時取代圖表的那一句。不寫「資料不足」——那是站上的禁用詞，而且它沒有回答「差多少」。
export function lessThanAYearText(total: number | null): string {
  return total === null || total <= 0 ? '這一檔還沒有可以畫圖的歷史。' : `這一檔目前只有 ${total} 季，未滿一年。`
}
