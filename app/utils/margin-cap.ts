// 利益率圖的縱軸上限（2026-11-12，使用者選 B）。5314 世紀 2021～2023 年每季營收只有一兩百萬元，營業利益率到 −522%，近 5 年的圖
// 縱軸撐到 ±600%，2024 年起 10～50% 的走勢被壓成一條線。超過 ±100% 表示虧損或業外損益比整季營收還大，比率已經不是在說獲利能力：
// 圖只畫到 ±100%，超出的點畫在邊上、換成箭頭；提示框與表格照舊是原數字。大多數期別都超出（營收很少的控股公司）就照實撐開。
// 財報三率圖（StockMultiSeriesLineChart 的 marginCap）與三率各自的指標頁（useMetricHistoryChartOption）共用。
// scripts/check-margin-cap.mjs 用 node 跑，所以這裡不碰自動匯入的東西
export const MARGIN_CAP = 100
export const MARGIN_CAP_METRICS = new Set(['grossMargin', 'operatingMargin', 'netProfitMargin'])
export const MARGIN_CAP_NOTE = '超過 ±100%（原數字見表格）'

export interface MarginBounds { min?: number, max?: number }

// 這一段要不要截、截哪一邊；不截回 null
export function marginBounds(values: number[]): MarginBounds | null {
  const over = values.filter(value => Math.abs(value) > MARGIN_CAP)
  if (!over.length || over.length * 2 >= values.length) return null
  return {
    ...(over.some(value => value < 0) ? { min: -MARGIN_CAP } : {}),
    ...(over.some(value => value > 0) ? { max: MARGIN_CAP } : {})
  }
}

// 截掉的點畫在邊上的哪裡、箭頭朝上還是朝下；沒截的回 null
export function cappedPoint(value: number, bounds: MarginBounds | null): { value: number, up: boolean } | null {
  if (bounds?.min !== undefined && value < bounds.min) return { value: bounds.min, up: false }
  if (bounds?.max !== undefined && value > bounds.max) return { value: bounds.max, up: true }
  return null
}
