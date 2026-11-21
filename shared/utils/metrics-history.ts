import type { AbsentPeriod, MetricsHistoryEntry } from '../types/metrics-history.ts'

// 財報更正、重編與沒申報的期別（數據中台 A 批，2026-11-22）在讀進來的地方併進格子，讀格子的圖表與表格（periodNotesText、
// nullReasonShortText）就都看得到，不用一個一個改：那一期的 notes 接到它每一格的 notes（同一句只寫一次）；沒申報的期別補一列，
// 每一格是帶原因的 null（圖上是缺口、表格寫「未申報」），已經有那一期的話只補沒有紀錄的格子。比第一期還早的不補：不在這次要的期數裡。
// 沒申報的期別 2026-11-22 先不傳（兩個呼叫端只給 entries）：DEV 的 absentPeriods 把只申報半年報那幾年的第一、三季也列成 no_filing
//（3158 的 2020～2023），照畫會寫成「未申報」像是漏報，已請數據中台拿掉沒有申報義務的期別，確認後呼叫端再傳 absentPeriods
export function withPeriodFacts(entries: MetricsHistoryEntry[], codes: readonly string[], absentPeriods: AbsentPeriod[] = []): MetricsHistoryEntry[] {
  const order = (period: { fiscalYear: number, fiscalQuarter: number | null }) => period.fiscalYear * 10 + (period.fiscalQuarter ?? 0)
  const merged = entries.map(({ notes, ...entry }) => ({
    ...entry,
    values: Object.fromEntries(Object.entries(entry.values).map(([code, point]) => [code, point && notes?.length ? { ...point, notes: [...(point.notes ?? []), ...notes] } : point]))
  }))
  const first = merged[0] ? order(merged[0]) : Infinity
  for (const absent of absentPeriods) {
    if (order(absent) < first) continue
    const cell = () => ({ value: null, nullReason: absent.nullReason, knowledgeDate: '', knowledgeDateIsFallback: false })
    const existing = merged.find(entry => order(entry) === order(absent))
    if (existing) for (const code of codes) existing.values[code] ??= cell()
    else merged.push({ fiscalYear: absent.fiscalYear, fiscalQuarter: absent.fiscalQuarter, values: Object.fromEntries(codes.map(code => [code, cell()])) })
  }
  return merged.sort((a, b) => order(a) - order(b))
}
