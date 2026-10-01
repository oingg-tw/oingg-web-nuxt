import type { MetricsHistoryEntry, MetricsHistoryPoint, MetricsHistoryTimeframe } from '#shared/types/metrics-history'
import { formatSignificantDigits } from '~/utils/format-significant-digits'
import { nullReasonShortText } from '~/utils/metric-null-reason'

// 2026-10-01：從 StockMetricDetailPage.vue 抽出來，因為徽章頁也要那張「歷年變化」表（使用者：
// 「roe 沒有歷年變化的表格又是為什麼?」）。抽的是**計算**不是版面——版面在
// StockMetricHistorySection.vue，而指標頁除了那張表之外還要用同一組數字算 <title>、meta
// description 與開頭那一句，所以不能只有元件、必須有一份共用的函式。

// 名字避開 useMetricHistoryChartOption.ts 的 MetricHistoryPoint（那是圖表的點，只有 x/y）：
// 自動 import 的全域命名空間是平的，同名會被忽略其中一個。
export interface MetricHistoryEntryPoint extends MetricsHistoryEntry {
  point: MetricsHistoryPoint | null
}

// bff-ts 回傳由舊到新；表格與開頭那一句要的都是由新到舊。
// 值為 null 但**帶理由**的那一期要留著（不是沒資料，是算不出來，見 metricCellText 的註解），
// 所以濾掉的只有「這一期根本沒有這支指標的紀錄」。
export function metricHistoryPoints(entries: MetricsHistoryEntry[], metricCode: string): MetricHistoryEntryPoint[] {
  return entries
    .map(entry => ({ ...entry, point: entry.values[metricCode] ?? null }))
    .filter(entry => entry.point !== null)
    .reverse()
}

// 近四季 vs 單季 matters for how the number reads, so the basis is stated rather than left for the
// reader to assume — the same distinction the 指標歷史 table's own toggle makes.
export const TIMEFRAME_LABEL: Record<MetricsHistoryTimeframe, string> = { TTM: '近四季合計', Q: '單季', FY: '會計年度' }

export const periodLabelOf = (timeframe: MetricsHistoryTimeframe, fiscalYear: number, fiscalQuarter: number): string =>
  timeframe === 'FY' ? `${fiscalYear}` : `${fiscalYear} Q${fiscalQuarter}`

// A null with a REASON is not the same thing as no data, and this table was printing both as
//「尚無資料」until 2026-09-22. What surfaced it: analysis-ts added a zero-denominator guard to four
// cash-flow metrics（fcfConversionRate among them）, so 1101's last four quarters went from a wild
// number to null with `zero_or_negative_denominator` — the ratio is undefined because free cash
// flow was zero or negative, which is a fact about the company, not a gap in the data.
//
// Reuses the labels and the title-attribute convention StockHistoricalStatisticsTable and
// StockMetricSeriesTable already share（app/utils/metric-null-reason.ts）rather than inventing a
// third wording: 不適用 for the industry case, 無法計算 for the rest, with the specific reason in
// the cell's own title. Only「no record at all」still reads 尚無資料.
export function metricCellText(point: { value: number | null; nullReason: string | null } | null | undefined, unit: string): string {
  if (!point) return '尚無資料'
  if (point.value !== null) return `${formatSignificantDigits(point.value, 3)}${unit}`
  return nullReasonShortText(point.nullReason)
}

// Span of the table, stated in the section's own answer line so the reader knows how far back the
// numbers go without counting rows — this app holds itself to a 近10年 target for fundamentals and
// most symbols fall well short of it (a market-wide 2022Q1 data floor).
export function metricHistoryAnswer(
  points: MetricHistoryEntryPoint[],
  options: { shortName: string; topic: string; timeframe: MetricsHistoryTimeframe }
): string | null {
  if (points.length < 2) return null
  const oldest = points[points.length - 1]!
  const newest = points[0]!
  const label = TIMEFRAME_LABEL[options.timeframe]
  return `以下為 ${options.shortName} 由新到舊的 ${options.topic}（${label}），共 ${points.length} 期，涵蓋 ${periodLabelOf(options.timeframe, oldest.fiscalYear, oldest.fiscalQuarter)} 至 ${periodLabelOf(options.timeframe, newest.fiscalYear, newest.fiscalQuarter)}。`
}
