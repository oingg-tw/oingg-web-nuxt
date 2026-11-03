import type { StatementType } from './financial-statement'

// GET /stocks/:symbol/metric-provenance (業務中台 proxy of analysis-ts's own
// GET /companies/:symbol/metric-provenance). Lives in shared/ so server/utils/stock-data.ts's Nitro
// cache layer and the browser share one wire shape (same reason financial-statement.ts and
// stock-badges.ts live here).
export interface MetricProvenanceEntry {
  role: string
  fiscalYear: number
  // 2026-10-07 業務中台 f750e92：上游本來就可能是 null，業務中台 以前轉成 "null"／0／false，現在原樣傳 null
  fiscalQuarter: number | null
  // null：那一期的財報沒有這個科目、或由它算出來的平均（2026-10-21 實測 6741 的存貨與應付帳款）
  value: number | null
  type: 'statementField' | 'other'
  // Only present on `type: 'statementField'` — fieldKey exact-matches
  // GET /stocks/:symbol/financial-statement's own keys (analysis-ts's own guarantee, cross-
  // checked against that endpoint for every entry on their side), which is what lets
  // jumpToStatementRow() use it directly as a StockFinancialStatementsCard.vue row key with no
  // second lookup table.
  statementType?: StatementType
  fieldKey?: string
  // Only present on `type: 'other'` (market price snapshots, share-count filings, etc.) — no
  // jump-to-source destination exists for these, just a plain description.
  sourceDescription?: string
}

export interface MetricProvenanceResponse {
  symbol: string
  metricCode: string
  found: boolean
  fiscalYear: number | null
  fiscalQuarter: number | null
  value: number | null
  entries: MetricProvenanceEntry[]
  // Non-null only when the full computation isn't itemized (e.g. SUE's 20-quarter stddev
  // sample) — explains the gap instead of silently showing a partial list with no context.
  methodologyNote: string | null
}
