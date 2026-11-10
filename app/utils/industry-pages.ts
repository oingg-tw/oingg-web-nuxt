import type { IndustryPageData } from '#shared/types/hub'
import type { LineSeriesSpec } from '~/components/stock/StockMultiSeriesLineChart.vue'

// 類股個別頁（2026-10-21）圖與表共用的整理與格式。面向清單在 shared/utils/hub-slugs.ts 的 INDUSTRY_FACETS（sitemap 也要讀）。
// 只陳述家數、中位數、分位數，不寫形容詞（合規用語）

// Deterministic on both renders: toFixed only, null → '－'
export const industryNum = (value: number | null, decimals = 2) => (value === null ? '－' : minusSign(value.toFixed(decimals)))
export const industrySignedPct = (value: number | null) => (value === null ? '－' : minusSign(`${value > 0 ? '+' : ''}${value.toFixed(2)}%`))
export const industryPct = (value: number | null | undefined) => (value == null ? '－' : minusSign(`${value.toFixed(2)}%`))
// 股利成長率一位小數（同 /industries/dividend）
export const industryGrowthPct = (value: number | null) => (value === null ? '－' : minusSign(`${value.toFixed(1)}%`))
export const industryStat = (value: number | null, unit: string) => (value === null ? '－' : minusSign(`${value.toFixed(2)}${unit === '倍' ? ' 倍' : '%'}`))

// 三率中位數（近四季）
export const INDUSTRY_MARGIN_SERIES: LineSeriesSpec[] = [
  { code: 'grossMargin', name: '毛利率中位數', lineType: 'solid', symbol: 'circle' },
  { code: 'operatingMargin', name: '營業利益率中位數', lineType: 'dashed', symbol: 'triangle' },
  { code: 'netProfitMargin', name: '稅後淨利率中位數', lineType: 'dotted', symbol: 'rect' }
]

// 三支各自一次類股中位數逐期，依年度／季別併成一列（舊的在前）；count 是毛利率那一支的有值家數
export function industryMarginRows(data: IndustryPageData) {
  const byPeriod = new Map<string, { fiscalYear: number; fiscalQuarter: number; values: Record<string, { value: number | null }>; count: number }>()
  for (const spec of INDUSTRY_MARGIN_SERIES) {
    for (const entry of data.marginTrend[spec.code as keyof IndustryPageData['marginTrend']]?.entries ?? []) {
      const key = `${entry.fiscalYear}-${entry.fiscalQuarter}`
      const row = byPeriod.get(key) ?? { fiscalYear: entry.fiscalYear, fiscalQuarter: entry.fiscalQuarter, values: {}, count: 0 }
      row.values[spec.code] = { value: entry.median }
      if (spec.code === 'grossMargin') row.count = entry.count
      byPeriod.set(key, row)
    }
  }
  return [...byPeriod.values()].sort((a, b) => a.fiscalYear - b.fiscalYear || a.fiscalQuarter - b.fiscalQuarter)
    .filter(row => INDUSTRY_MARGIN_SERIES.some(spec => row.values[spec.code]?.value != null))
}

// 分布（2026-10-09 產業分析設計）：四列單位不同（倍、%），各自一個座標；少於 5 家有值的不畫
export function industryDistribution(data: IndustryPageData) {
  const stats = data.companies.stats
  return [
    { label: '本益比', unit: '倍', stat: stats.peRatio },
    { label: '股價淨值比', unit: '倍', stat: stats.pbRatio },
    { label: '殖利率', unit: '%', stat: stats.dividendYield },
    { label: 'ROE（近四季）', unit: '%', stat: stats.roe }
  ].filter(item => item.stat.median !== null && item.stat.count >= 5)
}

// 持股股利成長率怎麼讀（2026-11-04，使用者：「避免股價成長過快 造成殖利率衰退 但是 實際上用戶領到更多」）：/industries、
// /industries/dividend、/industry/[sector]/dividend 同一句。成長率本身就是用買進價算的（2026-11-08，使用者：「殖利率分析本身，就應該用成本殖利率
// 來計算成長率，才合理，才看得出來長期持有的體驗」），所以 3 年那一支與成本殖利率同一天拿掉，這句也不再提成本殖利率這個詞
export const HOLDER_DIVIDEND_NOTE = '持股股利 5 年成長率是 5 年前買進、一直抱著的人，每年領到的現金股利的年化成長率，配股、分割、減資造成的股數變化都算進去，跟股價無關。分母一直是當年的買進價，所以它也是這個人用買進價算的殖利率，每年成長多少；5 年前有配息、現在不配息的公司是 −100%。股價漲得比股利快時，殖利率會變低，股利卻可能還在成長。'

// 手機四張表最右欄的欄名：要看得出是成長率（2026-11-06，使用者：原本的「股利 5 年」看不出來）；不留空格，同「近5年」
export const HOLDER_DIVIDEND_LABEL = '股利5年成長'

// 殖利率與持股股利 5 年成長率都有值的公司（5 年前沒有配息紀錄的算不出成長率）
export const industryScatterRows = (data: IndustryPageData) =>
  data.companies.rows.filter(row => row.dividendYield !== null && row.holdingDividendGrowthRate5y !== null)

// 盈餘發放率（2026-11-10）：類股頁只拿跟類股分布同一個年度的數字比。screener 給的是每家最新的年度，類股分布每年 9 月 1 日才換年，
// 1～8 月有些公司已經有新年度的數字，那些另外數（otherYear），不跟類股的中位數比；沒有年度的 null 是還沒有年度數字
export function industryPayoutRows(data: IndustryPageData, year: number) {
  const inYear = (row: IndustryPageData['companies']['rows'][number]) => row.dividendPayoutRatioYear === null || row.dividendPayoutRatioYear === year
  const rows = data.companies.rows
  return {
    shown: rows.filter(row => inYear(row) && row.dividendPayoutRatio !== null),
    missing: rows.filter(row => inYear(row) && row.dividendPayoutRatio === null),
    otherYear: rows.filter(row => !inYear(row))
  }
}
