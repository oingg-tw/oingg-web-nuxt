// Shared screener types. The actual search path is now useScreenerPresets() (every
// screener tab is backed by a saved preset, run via GET /screener/presets/{id}/run) —
// these are just the pieces both that composable and the /filters-driven UI need.

export interface FilterCriterion {
  field: string
  min: number | null
  max: number | null
  exclude: boolean
}

export interface ScreenerResultColumn {
  field: string
  metricName: string
  fieldName: string
}

// Breaking change confirmed live with bff-ts 2026-08-31: values[field] used to be a plain
// string, now every field comes back as this object instead — asOfDate is the report
// period/trading day that specific number describes (not when the query ran), added so the
// UI can show data freshness per number. Different symbols can legitimately show different
// asOfDate for the same field in the same response (e.g. one company hasn't filed this
// quarter yet) — expected, not a bug.
//
// asOfDate's format changed 2026-09-08 alongside the pitMetrics query-layer rebuild (confirmed
// live with bff-ts): it used to vary by field — daily/technical metrics gave a real
// "YYYY-MM-DD" trading date, quarterly-report-backed metrics (roe, altmanZScore,
// piotroskiFScore, etc.) instead gave a "{2-digit year}Q{season}" fiscal-quarter label like
// "26Q2". Now EVERY field returns a real "YYYY-MM-DD" date uniformly, no more fiscal-quarter
// strings. Still treated as an opaque display string here regardless — never parse/format it as
// a date — OrganismResultTable.vue only ever interpolates it directly, so this format change
// needed no code fix, only this comment update.
// value corrected to string | null 2026-09-02 — a live POST /screener/values response (used
// by the dashboard's 個股健檢 card) came back with the entry itself present but its value null
// (e.g. {value: null, asOfDate: "2026-08-11"} for a symbol with no computable Piotroski
// F-Score, distinct from the whole entry being absent below). OrganismResultTable.vue's own
// formatValue already handled this defensively (`raw: string | null | undefined`) despite the
// type here previously claiming value was never null — this just makes the type match what the
// code already assumed.
export interface ScreenerFieldValue {
  value: string | null
  asOfDate: string
}

export interface ScreenerResultRow {
  symbol: string
  name: string
  // Keyed by the same `field` string as ScreenerResultColumn.field — can be absent (the whole
  // entry null) for a field never computed for this company, distinct from an entry that
  // exists but whose own .value is null (see ScreenerFieldValue's own comment) — both render
  // the same "—" in practice, but are different states on the wire.
  values: Record<string, ScreenerFieldValue | null>
}
