import type { AbsentPeriod, MetricsHistoryEntry } from '../types/metrics-history.ts'

// 財報更正、重編與沒申報的期別（數據中台 A 批，2026-11-22）在讀進來的地方併進格子，讀格子的圖表與表格（periodNotesText、
// nullReasonShortText）就都看得到，不用一個一個改：那一期的 notes 接到它每一格的 notes（同一句只寫一次）；沒申報的期別（absentPeriods：
// no_filing 未申報、unsupported_format 格式還讀不到）補一列，每一格是帶原因的 null，圖上是缺口、表格寫原因。不補的：比第一期還早的
//（不在這次要的期數裡）、回應裡已經有的（數據中台不會列，以防萬一）、只申報半年報那幾年的第一、三季（semiannual_only：本來就沒有
// 申報義務，補了圖上每兩點之間都斷開、表格多一排「不適用」）。期限還沒過、第一次申報以前的，數據中台不列（706a0df）
export function withPeriodFacts(entries: MetricsHistoryEntry[], codes: readonly string[], absentPeriods: AbsentPeriod[] = []): MetricsHistoryEntry[] {
  const order = (period: { fiscalYear: number, fiscalQuarter: number | null }) => period.fiscalYear * 10 + (period.fiscalQuarter ?? 0)
  const merged = entries.map(({ notes, ...entry }) => ({
    ...entry,
    values: Object.fromEntries(Object.entries(entry.values).map(([code, point]) => [code, point && notes?.length ? { ...point, notes: [...(point.notes ?? []), ...notes] } : point]))
  }))
  const listed = new Set(merged.map(order))
  const first = merged[0] ? order(merged[0]) : Infinity
  for (const absent of absentPeriods) {
    if (absent.nullReason === 'semiannual_only' || order(absent) < first || listed.has(order(absent))) continue
    merged.push({ fiscalYear: absent.fiscalYear, fiscalQuarter: absent.fiscalQuarter, values: Object.fromEntries(codes.map(code => [code, { value: null, nullReason: absent.nullReason, knowledgeDate: '', knowledgeDateIsFallback: false }])) })
  }
  return merged.sort((a, b) => order(a) - order(b))
}
