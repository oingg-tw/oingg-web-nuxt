// 六面向（/stock/{code}/six-dimensions 與指標速覽的小卡，2026-11-27 使用者設計；設計圖 https://claude.ai/artifact/FWP3mJfa44md4csrM31MAb）：
// 一家公司在六件事上各排在上市櫃公司的哪個位置。數字與每個組成指標的百分位都是數據中台算好的（GET /companies/radar-breakdown，
// 經業務中台），這裡只排版：固定的軸序、雷達圖的座標、答句。算法在數據中台 crates/domain/src/market/radar.rs，2026-11-27 核對過：
// 每支組成指標轉成越大越好、在上市櫃普通股裡排百分位（同分取中間，最低 0、最高 100），至少一半有值才平均，平均再排一次全體百分位；
// 價值的三支在同產業裡排。所以畫面寫「百分位 N」，不寫「高過 N% 的公司」（同分的是一大群），也不寫強弱好壞。
// scripts/check-six-dimensions.mjs 直接 import 這個檔案，所以不寫 import

export interface RadarComponent {
  fieldId: string
  order: 'asc' | 'desc'
  negativeLast: boolean
  // sector：跟同產業比（價值的三支）；market：跟全部上市櫃公司比
  scope: 'market' | 'sector'
  value: number | string | null
  knowledgeDate: string | null
  percentile: number | null
  nullReason: string | null
}

export interface RadarAxis {
  metricCode: string
  value: number | null
  nullReason: string | null
  components: RadarComponent[]
}

export interface RadarBreakdown {
  symbol: string
  asOf: string | null
  axes: RadarAxis[]
}

// 六個軸的順序與名稱固定（詞彙表「六面向」那一列）：每家公司的形狀才比得起來。上游多給的不畫、少給的當沒有值
export const SIX_DIMENSIONS = [
  { code: 'growthMomentumPercentile', label: '成長動能' },
  { code: 'priceTrendPercentile', label: '價格趨勢' },
  { code: 'fundamentalImprovementPercentile', label: '體質改善' },
  { code: 'valuePercentile', label: '價值' },
  { code: 'financialSafetyPercentile', label: '財務安全' },
  { code: 'shareholderReturnPercentile', label: '股東回饋' }
] as const

// 雷達圖上方那一列（全站圖表的畫法：單位在左、說明在右）：頁面與指標速覽的卡片共用
export const SIX_DIMENSIONS_LEGEND = [
  { unit: '百分位（0 最低、100 最高）', items: [] },
  { right: true, items: [{ name: '50：上市櫃公司的中間', color: 'currentColor', kind: 'line' as const, dash: 'dashed' as const }] }
]

export interface SixDimensionAxis {
  code: string
  label: string
  value: number | null
  nullReason: string | null
  components: RadarComponent[]
}

export function sixDimensionAxes(breakdown: Pick<RadarBreakdown, 'axes'> | null | undefined): SixDimensionAxis[] {
  return SIX_DIMENSIONS.map(({ code, label }) => {
    const axis = breakdown?.axes.find(item => item.metricCode === code)
    const value = typeof axis?.value === 'number' && Number.isFinite(axis.value) ? axis.value : null
    return { code, label, value, nullReason: value === null ? axis?.nullReason ?? null : null, components: axis?.components ?? [] }
  })
}

// 表格寫兩位（資料的精度）；圖上與答句寫整數
export const percentileText = (value: number | null | undefined): string => (typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '－')
export const percentileLabel = (value: number | null): string => (value === null ? '無法計算' : String(Math.round(value)))

// 一個面向為什麼算不出來（數據中台 2026-11-27）：扣掉這個產業不適用的指標之後不到一半是 not_applicable_industry（金融業的體質改善），
// 其餘是 missing_input。不認得的原因只寫無法計算，不猜
export const sixDimensionNullText = (nullReason: string | null | undefined): string =>
  nullReason === 'not_applicable_industry' ? '組成指標不適用於這個產業' : nullReason === 'missing_input' ? '組成指標不到一半有值' : ''

// 第 k 個軸在半徑 r 的座標：第一個軸在正上方，順時針；原點是圖的中心
function radarPoint(k: number, r: number, count: number): [number, number] {
  const angle = (-90 + (360 / count) * k) * Math.PI / 180
  // + 0：四捨五入出來的 −0 變成 0
  return [Math.round(r * Math.cos(angle) * 10) / 10 + 0, Math.round(r * Math.sin(angle) * 10) / 10 + 0]
}
const pointsText = (points: [number, number][]) => points.map(point => point.join(',')).join(' ')

export interface RadarGeometry {
  // 25、50、75、100 四圈的多邊形頂點
  rings: { percent: number; points: string }[]
  // 每個軸的外端
  spokes: [number, number][]
  // 有值的頂點；沒有值的軸是 null
  dots: ([number, number] | null)[]
  // 填色與連線：相鄰兩個軸都有值才畫那一段（沒有值的軸不連線、不填色，同全站「缺值留空、不畫過去」）
  fill: string
  line: string
}

export function radarGeometry(values: (number | null)[], radius: number): RadarGeometry {
  const count = values.length
  const dots = values.map((value, k) => (value === null ? null : radarPoint(k, radius * Math.min(100, Math.max(0, value)) / 100, count)))
  const fill: string[] = []
  const line: string[] = []
  dots.forEach((dot, k) => {
    const next = dots[(k + 1) % count]
    if (!dot || !next) return
    fill.push(`M0,0L${dot.join(',')}L${next.join(',')}Z`)
    line.push(`M${dot.join(',')}L${next.join(',')}`)
  })
  return {
    rings: [25, 50, 75, 100].map(percent => ({ percent, points: pointsText(values.map((_, k) => radarPoint(k, radius * percent / 100, count))) })),
    spokes: values.map((_, k) => radarPoint(k, radius, count)),
    dots,
    fill: fill.join(''),
    line: line.join('')
  }
}

// 卡片之前那一句（至多 80 字）：最高與最低各在哪個位置；算不出來的面向說出來。一個都沒有回 null，由頁面寫原因
export function sixDimensionsAnswer(axes: Pick<SixDimensionAxis, 'label' | 'value'>[], asOf: string | null | undefined): string | null {
  const known = axes.filter((axis): axis is { label: string; value: number } => axis.value !== null)
  if (!known.length) return null
  const missing = axes.filter(axis => axis.value === null).map(axis => axis.label)
  const missingText = missing.length ? `${missing.join('、')}算不出來。` : ''
  const dateText = asOf ? `資料日期 ${asOf}。` : ''
  const highest = known.reduce((best, axis) => (axis.value > best.value ? axis : best))
  const lowest = known.reduce((best, axis) => (axis.value < best.value ? axis : best))
  if (known.length === 1) return `六個面向裡只有${highest.label}算得出來，百分位 ${percentileLabel(highest.value)}。${dateText}`
  if (highest.value === lowest.value) return `${known.length === axes.length ? '六個面向' : `算得出來的 ${known.length} 個面向`}的百分位都是 ${percentileLabel(highest.value)}。${missingText}${dateText}`
  return `六個面向裡，${highest.label}的百分位 ${percentileLabel(highest.value)}，最高；${lowest.label}的百分位 ${percentileLabel(lowest.value)}，最低。${missingText}${dateText}`
}

// 給螢幕閱讀器的一句：圖上每個軸的名稱與數字
export const sixDimensionsAriaLabel = (shortName: string, axes: Pick<SixDimensionAxis, 'label' | 'value'>[]): string =>
  `${shortName}六面向雷達圖：${axes.map(axis => `${axis.label} ${axis.value === null ? '無法計算' : percentileLabel(axis.value)}`).join('、')}`
