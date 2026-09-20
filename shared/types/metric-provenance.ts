import type { StatementType } from './financial-statement'

// GET /stocks/:symbol/metric-provenance (bff-ts proxy of analysis-ts's own
// GET /companies/:symbol/metric-provenance) — moved here 2026-09-20 from
// app/composables/stock/useMetricProvenance.ts so server/utils/stock-data.ts's Nitro cache layer
// can share the wire shape with the browser composable (same reason financial-statement.ts and
// stock-badges.ts live here); useMetricProvenance.ts re-exports these, every existing import
// keeps working.
export interface MetricProvenanceEntry {
  role: string
  fiscalYear: number
  fiscalQuarter: number
  // No fixed type on the wire — bff-ts confirmed live 2026-09-10: most entries are
  // bigint-serialized strings (raw statement figures, e.g. "706561938"), but chowderNumber's
  // cash-dividend-yield "market snapshot" entry comes back as a plain float (0.92) instead.
  // Never assume string; formatProvenanceValue() in the consuming component checks the type.
  value: string | number
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
