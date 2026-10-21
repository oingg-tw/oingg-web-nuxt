import type { IndustryPageData } from '#shared/types/hub'
import type { LineSeriesSpec } from '~/components/stock/StockMultiSeriesLineChart.vue'

// 類股個別頁（2026-10-21）圖與表共用的整理與格式。面向清單在 shared/utils/hub-slugs.ts 的 INDUSTRY_FACETS（sitemap 也要讀）。
// 只陳述家數、中位數、分位數，不寫形容詞（合規用語）

// Deterministic on both renders: toFixed only, null → '－'
export const industryNum = (value: number | null, decimals = 2) => (value === null ? '－' : value.toFixed(decimals))
export const industrySignedPct = (value: number | null) => (value === null ? '－' : `${value > 0 ? '+' : ''}${value.toFixed(2)}%`)
export const industryPct = (value: number | null | undefined) => (value == null ? '－' : `${value.toFixed(2)}%`)
export const industryStat = (value: number | null, unit: string) => (value === null ? '－' : `${value.toFixed(2)}${unit === '倍' ? ' 倍' : '%'}`)

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

// 殖利率與股利 3 年成長率都有值的公司（全市場只有約 57% 的公司有連續三年的股利紀錄）
export const industryScatterRows = (data: IndustryPageData) =>
  data.companies.rows.filter(row => row.dividendYield !== null && row.dividendGrowthRate3y !== null)
