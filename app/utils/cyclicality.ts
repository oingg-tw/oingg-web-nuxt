// 景氣循環度（/stock/{code}/cyclicality 與指標速覽可以釘的卡片；使用者 2026-11-28：「有辦法的設計卡片與指標，讓用戶知道這個個股本身是否
// 屬於景氣循環股嗎」，設計圖 https://claude.ai/artifact/MnW2nnuXRFn2TTiJUNThN5）：一家公司的財務特徵有多像景氣循環股，寫成它在上市櫃公司裡的
// 百分位。數字都是數據中台算好的（GET /companies/cyclicality-breakdown，經業務中台 /stocks/{symbol}/cyclicality-breakdown），這裡只排版：
// 位置、四項特徵的句子、年度營業利益率與趨勢線的座標。
// 「是不是」只寫位置，不分高中低、不貼標籤（使用者同日：「跟數據中臺核對 做出理論上與實務上的最佳選擇」，兩邊核對的結論）：他的指南說循環是
// 連續光譜；切點得平台自己訂（他的分位座標層規範不准）；資料上也找不到夠準又夠穩的切點（公認的循環股有 8～9 家排不到 70，一年約 6% 的公司
// 會換邊）。讀者要的參照是所屬產業的中位數（指南：先看產業、再看個別公司），畫在位置條上。
// scripts/check-cyclicality.mjs 直接 import 這個檔案，所以不寫 import（marginBounds、cappedPoint 是自動匯入的）

interface YearValue { fiscalYear: number, value: number }
interface QuarterValue { fiscalYear: number, fiscalQuarter: number, value: number }
interface Ranked { percentile?: number | null }
interface Item extends Ranked { nullReason?: string | null }

// 一支利益率（營業利益率、毛利率）的去趨勢結果：mean 是窗口內年度值的平均，ser 是每年離趨勢線的典型距離（迴歸標準誤，單位是百分點）；
// trendStart／trendEnd 兩點連起來就是趨勢線；points 是迴歸實際用到的年度值（v4 起，8～10 筆）
export interface CyclicalityMargin extends Ranked {
  mean?: number | null
  ser?: number | null
  trendStart?: YearValue | null
  trendEnd?: YearValue | null
  points?: YearValue[] | null
}

export interface CyclicalityBreakdown {
  asOf?: string | null
  // 合成的百分位（0～100）；算不出來是 null，原因在 nullReason
  value: number | null
  nullReason?: string | null
  // 所屬產業（v4 起；上市、上櫃同一套代碼合在一起算）：companies 是有分數的家數（含自己），median 是它們的中位數（不到 5 家是 null）。
  // 沒有分數的公司整個是 null
  sector?: { code?: string | null, name?: string | null, companies?: number | null, median?: number | null } | null
  profitSwing?: (Item & { fromYear?: number | null, toYear?: number | null, operatingMargin?: CyclicalityMargin | null, grossMargin?: CyclicalityMargin | null }) | null
  peakDecline?: (Item & {
    revenue?: (Ranked & { peak?: QuarterValue | null, trough?: QuarterValue | null, drawdownPct?: number | null }) | null
    operatingMargin?: (Ranked & { peak?: QuarterValue | null, trough?: QuarterValue | null, declinePp?: number | null }) | null
  }) | null
  peerComovement?: (Item & {
    months?: number | null
    sectorCode?: string | null
    sector?: (Ranked & { correlation?: number | null, peers?: number | null }) | null
    market?: (Ranked & { correlation?: number | null }) | null
  }) | null
  heavyAssets?: (Item & {
    fiscalYear?: number | null
    fiscalQuarter?: number | null
    ratio?: number | null
    ratioPercentile?: number | null
    turnover?: (Ranked & { swingPct?: number | null, highest?: YearValue | null, lowest?: YearValue | null }) | null
  }) | null
}

const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null)
// 兩位小數、負號是減號，四捨五入到 0.00 的負數不寫負號（同 fixedRateText）
const fixed2 = (value: number): string => {
  const text = Math.abs(value).toFixed(2)
  return `${value < 0 && text !== '0.00' ? '−' : ''}${text}`
}
const rate = (value: number): string => `${fixed2(value)}%`

// 四項特徵的順序與名稱固定（詞彙表「景氣循環度」）
export const CYCLICALITY_ITEMS = [
  { key: 'profitSwing', label: '獲利起伏' },
  { key: 'peakDecline', label: '高點回落' },
  { key: 'peerComovement', label: '同業連動' },
  { key: 'heavyAssets', label: '重資產' }
] as const

export interface CyclicalityItem { key: typeof CYCLICALITY_ITEMS[number]['key'], label: string, percentile: number | null, nullReason: string | null }

export function cyclicalityItems(breakdown: CyclicalityBreakdown | null | undefined): CyclicalityItem[] {
  return CYCLICALITY_ITEMS.map(({ key, label }) => {
    const percentile = num(breakdown?.[key]?.percentile)
    return { key, label, percentile, nullReason: percentile === null ? breakdown?.[key]?.nullReason ?? null : null }
  })
}

// 整個景氣循環度沒有值時寫哪一句（數據中台的原因碼）：不適用的是哪些公司、歷史要多長都寫出來，卡片與頁面共用。
// not_in_universe 是網站自己的：上游回 404（不在上市櫃普通股的比較範圍裡）
const MISSING_TEXTS: Record<string, string> = {
  not_applicable_industry: '金融保險業、建材營造業，以及用異業合併格式申報財報的公司，不適用景氣循環度。',
  insufficient_history: '財報未滿 8 年，算不出景氣循環度。',
  not_in_universe: '景氣循環度只算上市櫃的普通股，這一檔不在比較範圍裡。'
}
export const cyclicalityMissingText = (nullReason: string | null | undefined): string => MISSING_TEXTS[nullReason ?? ''] ?? '要用的財報數字不齊，目前算不出景氣循環度。'
// 某一項沒有值時，表格那一列補的原因（格子已經寫「無法計算」或「不適用」）
const ITEM_NULL_TEXTS: Record<string, string> = { insufficient_history: '歷史資料不夠長', missing_input: '要用的數字不齊' }
export const cyclicalityItemNullText = (nullReason: string | null | undefined): string => ITEM_NULL_TEXTS[nullReason ?? ''] ?? ''

// 位置條上的參照：所屬產業有分數的家數與中位數。名稱照回應，沒給（代碼表載不到）就用網站自己的類股名稱；家數或中位數沒有就不畫
export interface CyclicalitySector { name: string, companies: number, median: number }
export function cyclicalitySector(breakdown: CyclicalityBreakdown | null | undefined, names: Record<string, { name: string }>): CyclicalitySector | null {
  const [median, companies] = [num(breakdown?.sector?.median), num(breakdown?.sector?.companies)]
  const name = breakdown?.sector?.name || names[breakdown?.sector?.code ?? '']?.name
  return median !== null && companies !== null && name ? { name, companies, median } : null
}
export const cyclicalitySectorText = (sector: CyclicalitySector): string => `${sector.name} ${sector.companies} 家的中位數 ${Math.round(sector.median)}`

// 卡片之前那一句：位置與產業的中位數。四項各排在哪裡在下面的表，不再說一遍（2026-11-29，使用者：「個股景氣循環度 文字太多 導致 手機版閱覽
// 略顯擁擠吃力」）
export function cyclicalityAnswer(shortName: string, breakdown: CyclicalityBreakdown | null | undefined, sector: CyclicalitySector | null): string {
  const value = num(breakdown?.value)
  if (value === null) return cyclicalityMissingText(breakdown?.nullReason)
  return `${shortName}的景氣循環度是百分位 ${Math.round(value)}${sector ? `；${sector.name} ${sector.companies} 家的中位數是 ${Math.round(sector.median)}` : ''}。`
}

// 頁面的表：每一項底下是它看的兩個數字，各有自己的百分位，讀者看得出每一項的百分位怎麼來。一列一個短名稱、一個數字（同全站手機表格：
// 數字在欄位裡、名稱只寫一次），日期、平均、最高最低不寫進格子：句子在手機上一格折成三四行（2026-11-29，同上）。名稱照數據中台核對過的：
// 獲利起伏寫每年通常偏離趨勢線幾個百分點（不寫「占平均的 X%」：三分之一的公司十年平均是負的或接近 0）；營收寫「近四季合計」；同業連動的
// 同業是同產業「其他公司」的中位數，數字是相關係數（寫在那一項的標題）；重資產寫全名
export interface CyclicalityMeasure { label: string, value: string, percentile: number | null }
export interface CyclicalityRow extends CyclicalityItem { note: string, measures: CyclicalityMeasure[] }

const marginMeasure = (label: string, margin: CyclicalityMargin | null | undefined): CyclicalityMeasure[] => {
  const ser = num(margin?.ser)
  return ser === null ? [] : [{ label, value: `${fixed2(ser)} 個百分點`, percentile: num(margin?.percentile) }]
}

export function cyclicalityRows(breakdown: CyclicalityBreakdown | null | undefined, names: Record<string, { name: string }>): CyclicalityRow[] {
  const { profitSwing, peakDecline, peerComovement, heavyAssets } = breakdown ?? {}
  const [drawdown, decline] = [num(peakDecline?.revenue?.drawdownPct), num(peakDecline?.operatingMargin?.declinePp)]
  const sectorName = names[peerComovement?.sectorCode ?? '']?.name ?? '同產業'
  const [sectorCorrelation, marketCorrelation, peers] = [num(peerComovement?.sector?.correlation), num(peerComovement?.market?.correlation), num(peerComovement?.sector?.peers)]
  const [ratio, swing] = [num(heavyAssets?.ratio), num(heavyAssets?.turnover?.swingPct)]
  const measures: Record<CyclicalityItem['key'], { note: string, measures: CyclicalityMeasure[] }> = {
    profitSwing: {
      note: '',
      measures: [...marginMeasure('營業利益率偏離趨勢', profitSwing?.operatingMargin), ...marginMeasure('毛利率偏離趨勢', profitSwing?.grossMargin)]
    },
    peakDecline: {
      note: '',
      measures: [
        ...(drawdown === null ? [] : [{ label: '近四季合計營收跌幅', value: drawdown > 0 ? rate(drawdown) : '沒有跌過', percentile: num(peakDecline?.revenue?.percentile) }]),
        ...(decline === null ? [] : [{ label: '近四季營業利益率降幅', value: decline > 0 ? `${fixed2(decline)} 個百分點` : '沒有降過', percentile: num(peakDecline?.operatingMargin?.percentile) }])
      ]
    },
    peerComovement: {
      note: '相關係數',
      measures: [
        ...(sectorCorrelation === null ? [] : [{ label: `${sectorName}其他${peers === null ? '公司' : ` ${peers} 家`}`, value: fixed2(sectorCorrelation), percentile: num(peerComovement?.sector?.percentile) }]),
        ...(marketCorrelation === null ? [] : [{ label: '全市場', value: fixed2(marketCorrelation), percentile: num(peerComovement?.market?.percentile) }])
      ]
    },
    heavyAssets: {
      note: '',
      measures: [
        ...(ratio === null ? [] : [{ label: '不動產、廠房及設備占總資產', value: rate(ratio), percentile: num(heavyAssets?.ratioPercentile) }]),
        ...(swing === null ? [] : [{ label: '固定資產週轉率高低差', value: rate(swing), percentile: num(heavyAssets?.turnover?.percentile) }])
      ]
    }
  }
  return cyclicalityItems(breakdown).map(item => ({ ...item, ...measures[item.key] }))
}

// 營業利益率每年通常離趨勢線幾個百分點（迴歸標準誤）與十年平均：獲利起伏量的就是這兩個的比
export function cyclicalityTrendNumbers(margin: CyclicalityMargin | null | undefined): { ser: string, mean: string } | null {
  const [mean, ser] = [num(margin?.mean), num(margin?.ser)]
  return mean === null || ser === null ? null : { ser: fixed2(ser), mean: rate(mean) }
}
// 卡片的圖下面那一句，窄卡片一行放得下（平均寫在個股頁）
export function cyclicalityTrendCaption(margin: CyclicalityMargin | null | undefined): string {
  const numbers = cyclicalityTrendNumbers(margin)
  return numbers ? `營業利益率通常偏離趨勢線 ${numbers.ser} 個百分點` : ''
}

// 年度營業利益率的點與趨勢線（卡片與頁面同一張圖）。座標是圖面的百分比（x 由左到右、y 由上到下），線用拉伸的 SVG 畫、點與字是 HTML：
// 卡片的高度固定、寬度不定，圖要能橫向拉開，字與圓點不能跟著變形。
// 縱軸一定含 0：只看資料範圍會把中華電 19.6%～21.6% 放大成大起大落；含 0 時「離線多遠」相對於「離 0 多遠」，看起來就是獲利起伏量的那個比例。
// 超過 ±100% 的年度照全站利益率圖的規則畫在邊上、換成箭頭（marginBounds；多數年度都超出就照實撐開）
export interface CyclicalityTrend {
  years: [number, number]
  // 0% 那條線的 y；label 是「0%」標在哪一端。線就是底邊時也標：點離底邊多遠正是起伏小的樣子，不標讀者不知道底邊是 0（兩端的點都貼著線就不標）
  zero: number
  zeroLabel: 'start' | 'end' | null
  line: [number, number, number, number]
  dots: { year: number, x: number, y: number, capped: 'up' | 'down' | null }[]
  // 每個點到趨勢線的距離
  stems: { x: number, y1: number, y2: number }[]
  // 最高與最低那兩年的數字：最高的寫在點上面、最低的寫在點下面；靠邊的字往內靠
  labels: { text: string, x: number, y: number, below: boolean, align: 'start' | 'center' | 'end' }[]
  highest: YearValue
  lowest: YearValue
  capped: boolean
}

export function cyclicalityTrend(margin: CyclicalityMargin | null | undefined): CyclicalityTrend | null {
  const points = (margin?.points ?? []).filter(point => num(point?.value) !== null && Number.isInteger(point?.fiscalYear)).sort((a, b) => a.fiscalYear - b.fiscalYear)
  const [start, end] = [margin?.trendStart, margin?.trendEnd]
  if (points.length < 2 || !start || !end || num(start.value) === null || num(end.value) === null || end.fiscalYear <= start.fiscalYear) return null
  const [from, to] = [points[0]!.fiscalYear, points.at(-1)!.fiscalYear]
  if (to <= from) return null
  const bounds = marginBounds(points.map(point => point.value))
  const clamp = (value: number) => Math.min(bounds?.max ?? Infinity, Math.max(bounds?.min ?? -Infinity, value))
  const trendAt = (year: number) => start.value + (end.value - start.value) * ((year - start.fiscalYear) / (end.fiscalYear - start.fiscalYear))
  const shown = [...points.map(point => clamp(point.value)), clamp(trendAt(from)), clamp(trendAt(to))]
  const [high, low] = [Math.max(0, ...shown), Math.min(0, ...shown)]
  if (high === low) return null
  const round = (value: number) => Math.round(value * 100) / 100
  const x = (year: number) => round((year - from) / (to - from) * 100)
  const y = (value: number) => round((high - value) / (high - low) * 100)
  const inside = (value: number) => Math.min(100, Math.max(0, value))
  const dots = points.map((point) => {
    const capped = cappedPoint(point.value, bounds)
    return { year: point.fiscalYear, x: x(point.fiscalYear), y: y(clamp(point.value)), capped: capped ? (capped.up ? 'up' as const : 'down' as const) : null }
  })
  const highest = points.reduce((best, point) => (point.value > best.value ? point : best))
  const lowest = points.reduce((best, point) => (point.value < best.value ? point : best))
  const label = (point: YearValue, below: boolean) => {
    const at = x(point.fiscalYear)
    return { text: `${rate(point.value)}（${point.fiscalYear}）`, x: at, y: y(clamp(point.value)), below, align: at < 15 ? 'start' as const : at > 85 ? 'end' as const : 'center' as const }
  }
  const zero = y(0)
  // 「0%」標在右端；最後一年的點貼著線（不到圖高的 16%，字會壓到點）才標左端，兩端都貼著就不標
  const gaps = [Math.abs(dots[0]!.y - zero), Math.abs(dots.at(-1)!.y - zero)]
  const zeroLabel = gaps[1]! >= 16 ? 'end' as const : gaps[0]! >= 16 ? 'start' as const : null
  return {
    years: [from, to],
    zero,
    zeroLabel,
    line: [x(from), y(trendAt(from)), x(to), y(trendAt(to))],
    dots,
    stems: dots.map(dot => ({ x: dot.x, y1: dot.y, y2: inside(y(trendAt(dot.year))) })),
    labels: highest.fiscalYear === lowest.fiscalYear ? [label(highest, false)] : [label(highest, false), label(lowest, true)],
    highest,
    lowest,
    capped: !!bounds
  }
}

// 給螢幕閱讀器的一句：圖在說什麼（點與線對輔助科技隱藏）
export function cyclicalityTrendLabel(shortName: string, trend: CyclicalityTrend, margin: CyclicalityMargin | null | undefined): string {
  const caption = cyclicalityTrendCaption(margin)
  return `${shortName} ${trend.years[0]}～${trend.years[1]} 年的年度營業利益率與趨勢線：最高 ${rate(trend.highest.value)}（${trend.highest.fiscalYear} 年），最低 ${rate(trend.lowest.value)}（${trend.lowest.fiscalYear} 年）${caption ? `；${caption}` : ''}`
}
