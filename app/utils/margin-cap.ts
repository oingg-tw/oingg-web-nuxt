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

// 杜邦圖的左軸看多數期別（2026-11-15，使用者選 B：「因為她更好的呈現了ROE這個主軸資訊」）。3708 處分事業後營收幾乎是零，近四季
// 稅後淨利率 +379%／−487%，±100% 的上限還是讓 ROE（2%～39%）只佔五分之一高。這一軸的值（ROE 與稅後淨利率）取四分位距外推 3 倍
//（Tukey 的極端值界線）以內的範圍，往外留一點空間、取整到好讀的刻度；界線外的點畫在邊上、換成箭頭（cappedPoint）。
// 沒有離群值（多數公司）就不截。邊界只決定這一段怎麼畫，提示框與表格照舊是原數字
export const FENCE_NOTE = '超出多數期別的範圍（原數字見表格）'

export function fenceBounds(values: number[]): MarginBounds | null {
  if (values.length < 4) return null
  const sorted = [...values].sort((a, b) => a - b)
  const quantile = (p: number) => {
    const at = (sorted.length - 1) * p
    const low = Math.floor(at)
    return sorted[low]! + (sorted[Math.ceil(at)]! - sorted[low]!) * (at - low)
  }
  const q1 = quantile(0.25)
  const q3 = quantile(0.75)
  const reach = (q3 - q1) * 3
  const inside = sorted.filter(value => value >= q1 - reach && value <= q3 + reach)
  if (!inside.length) return null
  const below = sorted[0]! < inside[0]!
  const above = sorted.at(-1)! > inside.at(-1)!
  if (!below && !above) return null
  let min = Math.min(0, inside[0]!)
  let max = Math.max(0, inside.at(-1)!)
  const pad = (max - min) * 0.12 || 1
  if (below) min -= pad
  if (above) max += pad
  // 刻度間距：1、2、2.5、5 乘上十的次方，切成約五格
  const raw = (max - min) / 5
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map(multiple => multiple * magnitude).find(candidate => candidate >= raw)!
  return {
    ...(below ? { min: Math.floor(min / step) * step } : {}),
    ...(above ? { max: Math.ceil(max / step) * step } : {})
  }
}
