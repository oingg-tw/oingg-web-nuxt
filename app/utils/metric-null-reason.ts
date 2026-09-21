// Why a metric value is null, in the reader's words. Full nullReason enum confirmed by analysis-ts
// 2026-09-13 (metricNullReasonSchema in their own metricBasis.ts, exactly these 4 values) — only
// 'not_applicable_industry' means "this metric's model doesn't conceptually apply to this company"
// (the 5 crisis-warning models — Altman Z/Z″/Beneish M/Ohlson O/Zmijewski — excluding financial/
// insurance stocks); the other 3 are all "a real number, just not computable this period" for
// different reasons. Only the industry-inapplicable case gets a distinct in-cell label（不適用）;
// the rest render a plain「－」with the reason in the cell's title.
//
// Moved out of StockHistoricalStatisticsTable.vue on 2026-09-19 (the SEO build) so the new
// server-rendered series tables (StockMetricSeriesTable.vue) say the same things in the same way.
export const NULL_REASON_LABELS: Record<string, string> = {
  missing_input: '計算所需的原始申報欄位缺值',
  zero_or_negative_denominator: '分母為零或負值，比率無意義',
  not_applicable_industry: '依產業別，此指標的模型前提不適用於本公司',
  insufficient_history: '可比較的歷史資料深度不足',
  // Not a real analysis-ts value — a period with literally no computation record for this
  // metric (the whole chunk came back empty), distinct from a real null-with-reason.
  __no_record__: '此期別尚無此指標的計算紀錄'
}

export interface NullablePoint {
  value: number | null
  nullReason: string | null
}

export function nullReasonTitle(point: NullablePoint): string | undefined {
  if (point.value !== null || !point.nullReason) return undefined
  return NULL_REASON_LABELS[point.nullReason] ?? `原因代碼：${point.nullReason}`
}

// Integers stay integers（7、8）, everything else gets `decimals` places — deterministic on both
// renders（toFixed only, never toLocaleString）.
export function formatSeriesNumber(value: number, decimals = 2): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(decimals)
}

export function formatNullablePoint(point: NullablePoint | null | undefined, decimals = 2): string {
  if (!point || point.value === null) return point?.nullReason === 'not_applicable_industry' ? '不適用' : '－'
  return formatSeriesNumber(point.value, decimals)
}
