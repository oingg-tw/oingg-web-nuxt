import type { MetricsHistoryEntry, MetricsHistoryPoint, MetricsHistorySeries, MetricsHistoryTimeframe } from '#shared/types/metrics-history'
// 2026-10-01：從 StockMetricDetailPage.vue 抽出來，因為徽章頁也要那張「歷年變化」表（使用者：
// 「roe 沒有歷年變化的表格又是為什麼?」）。抽的是**計算**不是版面——版面在
// StockMetricHistorySection.vue，而指標頁除了那張表之外還要用同一組數字算 <title>、meta
// description 與開頭那一句，所以不能只有元件、必須有一份共用的函式。

// 名字避開 useMetricHistoryChartOption.ts 的 MetricHistoryPoint（那是圖表的點，只有 x/y）：
// 自動 import 的全域命名空間是平的，同名會被忽略其中一個。
export interface MetricHistoryEntryPoint extends MetricsHistoryEntry {
  point: MetricsHistoryPoint | null
}

// 歷年變化表用哪一份序列（2026-10-12「指標表格的歷史 統一用 單季 口徑」）：單季有任何一期有數值就用單季；
// 沒有單季口徑的指標（本益比、盈餘發放率、庫藏股殖利率等只有近四季或年度的）退回頁面本身的口徑。
export function pickQuarterlyHistory(
  quarterly: MetricsHistorySeries | null | undefined,
  series: MetricsHistorySeries | null | undefined,
  metricCode: string
): MetricsHistorySeries | null {
  if (quarterly?.entries.some(entry => entry.values[metricCode]?.value != null)) return quarterly
  return series ?? null
}

// 業務中台 回傳由舊到新；表格與開頭那一句要的都是由新到舊。
// 值為 null 但**帶理由**的那一期要留著（不是沒資料，是算不出來，見 metricCellText 的註解），
// 所以濾掉的只有「這一期根本沒有這支指標的紀錄」。
export function metricHistoryPoints(entries: MetricsHistoryEntry[], metricCode: string): MetricHistoryEntryPoint[] {
  return entries
    .map(entry => ({ ...entry, point: entry.values[metricCode] ?? null }))
    .filter(entry => entry.point !== null)
    .reverse()
}

// A null with a REASON is not the same thing as no data, and this table was printing both as
//「尚無資料」until 2026-09-22. What surfaced it: analysis-ts added a zero-denominator guard to four
// cash-flow metrics（fcfConversionRate among them）, so 1101's last four quarters went from a wild
// number to null with `zero_or_negative_denominator` — the ratio is undefined because free cash
// flow was zero or negative, which is a fact about the company, not a gap in the data.
//
// Reuses the labels and the title-attribute convention StockHistoricalStatisticsTable already
// uses（app/utils/metric-null-reason.ts）rather than inventing another wording: 不適用 for the industry case, 無法計算 for the rest, with the specific reason in
// the cell's own title. Only「no record at all」still reads 尚無資料.
export function metricCellText(point: { value: number | null; nullReason: string | null } | null | undefined, unit: string): string {
  if (!point) return '尚無資料'
  if (point.value !== null) return `${formatSignificantDigits(point.value, 4)}${unit}`
  return nullReasonShortText(point.nullReason)
}

// 個股頁每一張「一列一期」的歷史表共用的問句、答句與表名（2026-10-13，使用者：「每個表格的標題文字內容都不太一樣」，選了
// 問句統一「X的Y歷年變化如何？」、caption 一律藏起來）。label 同時是 <caption>（visually-hidden）與 SharedTable 的 label，
// check-stock-pages 斷言兩者相同。答句交代表格涵蓋多久，讀者不必數列數；頁面有其他帶數字的話接在這一句後面，不取代它。
export function historyTableText(options: { shortName: string; code: string; topic: string; basis?: string; count: number; countUnit?: string; from: string; to: string }) {
  const basis = options.basis ? `（${options.basis}）` : ''
  return {
    question: `${options.shortName}的${options.topic}歷年變化如何？`,
    answer: `以下為 ${options.shortName} 由新到舊的${options.topic}${basis}，共 ${options.count} ${options.countUnit ?? '期'}，涵蓋 ${options.from} 至 ${options.to}。`,
    label: `${options.shortName} ${options.code} 的${options.topic}逐期數據${basis}`
  }
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
  return historyTableText({ ...options, code: '', basis: TIMEFRAME_LABELS[options.timeframe], count: points.length, from: periodLabel(oldest, options.timeframe), to: periodLabel(newest, options.timeframe) }).answer
}
