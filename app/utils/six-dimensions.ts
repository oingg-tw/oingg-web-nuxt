// 六面向（/stock/{code}/six-dimensions 與指標速覽的小卡，2026-11-27 使用者設計；設計圖 https://claude.ai/artifact/FWP3mJfa44md4csrM31MAb）：
// 一家公司在六件事上各排在上市櫃公司的哪個位置。數字與每個組成指標的百分位都是數據中台算好的（GET /companies/radar-breakdown，
// 經業務中台），這裡只排版：固定的軸序、雷達圖的座標、答句。算法在數據中台 crates/domain/src/market/radar.rs，2026-11-27 核對過：
// 每支組成指標轉成越大越好、在上市櫃普通股裡排百分位（同分取中間，最低 0、最高 100），至少一半有值才平均，平均再排一次全體百分位；
// 價值型的三支在同產業裡排。所以畫面寫「百分位 N」，不寫「高過 N% 的公司」（同分的是一大群），也不寫強弱好壞。
// scripts/check-six-dimensions.mjs 直接 import 這個檔案，所以不寫 import

export interface RadarComponent {
  fieldId: string
  order: 'asc' | 'desc'
  negativeLast: boolean
  // sector：跟同產業比（價值型的三支）；market：跟全部上市櫃公司比
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
// 「價值型」原本叫「價值」（2026-11-27 使用者：「2330 六面向 價值 16 感覺像甚麼爛股票 名稱可以換換嗎?」，選「價值型」）：這一軸量的是股價相對
// 淨值、營收、營業現金流的倍數低不低，16 是股價倍數比多數同業高，不是公司差；「價值型」跟選股策略頁的分類同一個詞，讀成「不是價值股」
export const SIX_DIMENSIONS = [
  { code: 'growthMomentumPercentile', label: '成長動能' },
  { code: 'priceTrendPercentile', label: '價格趨勢' },
  { code: 'fundamentalImprovementPercentile', label: '體質改善' },
  { code: 'valuePercentile', label: '價值型' },
  { code: 'financialSafetyPercentile', label: '財務安全' },
  { code: 'shareholderReturnPercentile', label: '股東回饋' }
] as const

// 雷達圖上方那一列（全站圖表的畫法：單位在左、說明在右）：頁面與指標速覽的卡片共用。單位只寫「百分位」（2026-11-29，使用者：「六面向卡片手機版
// 請微調」）：原本「百分位（0 最低、100 最高）」在 375 寬的卡片上把這一列折成兩行，圖少 28px；0 到 100 寫在頁面的定義
export const SIX_DIMENSIONS_LEGEND = [
  { unit: '百分位', items: [] },
  { right: true, items: [{ name: '50：上市櫃公司的中間', color: 'currentColor', kind: 'line' as const, dash: 'dashed' as const }] }
]

export interface SixDimensionAxis {
  code: string
  label: string
  value: number | null
  nullReason: string | null
  components: RadarComponent[]
}

// 不適用的面向（2026-11-27 晚上起，數據中台說是使用者看過回測第二十四輪後定的；使用者 11-28 在這裡照這個前提要了三角形，見
// sixDimensionChartAxes）：金融保險業與異業合併格式申報的公司（和泰車、新纖、中纖、三商）只看成長動能、價格趨勢、股東回饋，體質改善、
// 價值型、財務安全整個面向是 not_applicable_industry。這種面向不列組成指標：上游還是會帶組成（富邦金的股價淨值比 1.67 倍），但沒有排名，
// 列出來只是數字配一格「－」
const NOT_APPLICABLE = 'not_applicable_industry'

// 圖上畫哪幾個面向（2026-11-28 使用者：「雷達圖要是只有三個面向解釋就改成三角形吧」）：不適用的面向不畫，剩幾個就是幾邊形，那 44 家是
// 三角形（答句與兩張表照舊列六個，其餘三個寫「不適用」）。算不出來的照畫、那一個軸不連線：它只是現在沒有值，不適用是這家公司一直不看。
// 適用的不到三個畫不成多邊形，照六個軸畫（現在沒有這種公司）
export function sixDimensionChartAxes<T extends { value: number | null; nullReason?: string | null }>(axes: T[]): T[] {
  const applicable = axes.filter(axis => axis.value !== null || axis.nullReason !== NOT_APPLICABLE)
  return applicable.length >= 3 ? applicable : axes
}

export function sixDimensionAxes(breakdown: Pick<RadarBreakdown, 'axes'> | null | undefined): SixDimensionAxis[] {
  return SIX_DIMENSIONS.map(({ code, label }) => {
    const axis = breakdown?.axes.find(item => item.metricCode === code)
    const value = typeof axis?.value === 'number' && Number.isFinite(axis.value) ? axis.value : null
    const nullReason = value === null ? axis?.nullReason ?? null : null
    return { code, label, value, nullReason, components: nullReason === NOT_APPLICABLE ? [] : axis?.components ?? [] }
  })
}

// 一個面向的組成指標跟誰比（明細表分組列括號裡那一句）：都跟同產業比的才寫；跟全部上市櫃公司比的不寫。
// 金融保險業的財務安全分五類、只跟同類比的那一套（financialType）只活了 2026-11-27 一個上午：同一天財務安全改成三支風險分數
//（Zmijewski、Beneish、應計比率）、金融保險業整個面向不適用，數據中台把分類比拿掉。不適用的面向沒有組成（sixDimensionAxes），這裡自然不寫
export function sixDimensionScopeText(axis: Pick<SixDimensionAxis, 'components'>): string {
  return axis.components.length > 0 && axis.components.every(component => component.scope === 'sector') ? '跟同產業比' : ''
}

// 明細表之後那一段的比較對象：價值型跟同產業比，其餘跟全部上市櫃公司比。都從資料來，組成改了跟著改
export function sixDimensionScopeNote(axes: Pick<SixDimensionAxis, 'label' | 'components'>[]): string {
  const sector = axes.filter(axis => sixDimensionScopeText(axis)).map(axis => axis.label)
  return sector.length ? `${sector.join('、')}的指標跟同產業的公司比（同產業不到 5 家的跟全部上市櫃公司比）。其餘跟全部上市櫃公司比。` : ''
}

// 表格寫兩位（資料的精度）；圖上與答句寫整數
export const percentileText = (value: number | null | undefined): string => (typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '－')
// 沒有值的面向寫什麼：不適用的寫「不適用」（全站同一個原因碼的格子都這樣寫），其餘是「無法計算」。圖上、兩張表、替代文字共用
export const sixDimensionMissingLabel = (nullReason: string | null | undefined): string => (nullReason === NOT_APPLICABLE ? '不適用' : '無法計算')
export const percentileLabel = (value: number | null, nullReason?: string | null): string => (value === null ? sixDimensionMissingLabel(nullReason) : String(Math.round(value)))

// 一個面向為什麼沒有值（數據中台 2026-11-27）：not_applicable_industry 是整個面向不適用（見上面 NOT_APPLICABLE；原本寫「組成指標不適用於
// 這個產業」，但價值型的股價淨值比對金融股明明有數字，而且和泰車的產業是汽車工業）。格子已經寫「不適用」，這裡只補「依產業或財報格式」
//（使用者 2026-11-28 照建議選的；原本是全站這個原因碼的「依產業別」，對和泰車、新纖、中纖、三商不準：它們是因為用異業合併格式申報，
// 不是因為產業）：是哪些公司寫在頁面最後的定義，一句話不在三列各寫一遍。扣掉歷史不足的之後不到一半是 insufficient_history
//（剛掛牌的價格趨勢、月營收不滿一年的成長動能）；其餘是 missing_input。不認得的原因只寫無法計算，不猜
const NULL_TEXTS = new Map([
  [NOT_APPLICABLE, '依產業或財報格式'],
  ['insufficient_history', '組成指標的歷史資料不夠長'],
  ['missing_input', '組成指標不到一半有值']
])
export const sixDimensionNullText = (nullReason: string | null | undefined): string => NULL_TEXTS.get(nullReason ?? '') ?? ''

// 第 k 個軸在半徑 r 的座標：第一個軸在正上方，順時針；原點是圖的中心
function radarPoint(k: number, r: number, count: number): [number, number] {
  const angle = (-90 + (360 / count) * k) * Math.PI / 180
  // + 0：四捨五入出來的 −0 變成 0
  return [Math.round(r * Math.cos(angle) * 10) / 10 + 0, Math.round(r * Math.sin(angle) * 10) / 10 + 0]
}
const pointsText = (points: [number, number][]) => points.map(point => point.join(',')).join(' ')

// 第 k 個軸的名稱放在圖四周六個位置的哪一個（0 正上，順時針：1 右上、2 右下、3 正下、4 左下、5 左上）：離那個軸最近的位置。
// 六個軸一個位置放一個；三個軸是 0、2、4（上、右下、左下）
export const radarSlot = (k: number, count: number): number => Math.round(k * 6 / count)

// 最外圈四周留給頂點圓點（半徑 5）的邊
const RADAR_MARGIN = 6

export interface RadarGeometry {
  // SVG 的 viewBox（左、上、寬、高）：最外圈的範圍加四周的邊。六個軸是 -93 -106 186 212；三個軸的底邊在 50，是 -93 -106 186 162
  box: [number, number, number, number]
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
  const spokes = values.map((_, k) => radarPoint(k, radius, count))
  const [xs, ys] = [spokes.map(point => point[0]), spokes.map(point => point[1])]
  const [left, top] = [Math.floor(Math.min(...xs) - RADAR_MARGIN), Math.floor(Math.min(...ys) - RADAR_MARGIN)]
  return {
    box: [left, top, Math.ceil(Math.max(...xs) + RADAR_MARGIN) - left, Math.ceil(Math.max(...ys) + RADAR_MARGIN) - top],
    rings: [25, 50, 75, 100].map(percent => ({ percent, points: pointsText(values.map((_, k) => radarPoint(k, radius * percent / 100, count))) })),
    spokes,
    dots,
    fill: fill.join(''),
    line: line.join('')
  }
}

// 卡片之前那一句（至多 80 字）：最高與最低各在哪個位置；不適用與算不出來的面向分開說。一個都沒有回 null，由頁面寫原因
export function sixDimensionsAnswer(axes: (Pick<SixDimensionAxis, 'label' | 'value'> & { nullReason?: string | null })[], asOf: string | null | undefined): string | null {
  const known = axes.filter((axis): axis is { label: string; value: number } => axis.value !== null)
  if (!known.length) return null
  const labelsOf = (notApplicable: boolean) => axes.filter(axis => axis.value === null && (axis.nullReason === NOT_APPLICABLE) === notApplicable).map(axis => axis.label)
  const [notApplicable, missing] = [labelsOf(true), labelsOf(false)]
  const missingText = `${notApplicable.length ? `${notApplicable.join('、')}不適用。` : ''}${missing.length ? `${missing.join('、')}算不出來。` : ''}`
  const dateText = asOf ? `資料日期 ${asOf}。` : ''
  const highest = known.reduce((best, axis) => (axis.value > best.value ? axis : best))
  const lowest = known.reduce((best, axis) => (axis.value < best.value ? axis : best))
  if (known.length === 1) return `六個面向裡只有${highest.label}算得出來，百分位 ${percentileLabel(highest.value)}。${dateText}`
  if (highest.value === lowest.value) return `${known.length === axes.length ? '六個面向' : `算得出來的 ${known.length} 個面向`}的百分位都是 ${percentileLabel(highest.value)}。${missingText}${dateText}`
  return `六個面向裡，${highest.label}的百分位 ${percentileLabel(highest.value)}，最高；${lowest.label}的百分位 ${percentileLabel(lowest.value)}，最低。${missingText}${dateText}`
}

// 給螢幕閱讀器的一句：圖上每個軸的名稱與數字
export const sixDimensionsAriaLabel = (shortName: string, axes: (Pick<SixDimensionAxis, 'label' | 'value'> & { nullReason?: string | null })[]): string =>
  `${shortName}個股輪廓雷達圖：${axes.map(axis => `${axis.label} ${percentileLabel(axis.value, axis.nullReason)}`).join('、')}`
