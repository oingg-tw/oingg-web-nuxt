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
  // Real unit ("%"/"元"/"分"/etc) shipped live by bff-ts 2026-09-09 — every field used to come
  // back with unit: null (see project_screener_backend_outage memory), which is why
  // StockHealthCheckCard.vue/StockGuruBadgeCard.vue each grew their own hardcoded per-field unit
  // fallback; both now read this instead.
  unit: string | null
}

// Breaking change confirmed live with bff-ts 2026-08-31: values[field] used to be a plain
// string, now every field comes back as this object instead — this field is the report
// period/trading day that specific number describes (not when the query ran), added so the
// UI can show data freshness per number. Different symbols can legitimately show different
// dates for the same field in the same response (e.g. one company hasn't filed this
// quarter yet) — expected, not a bug.
//
// Its format changed 2026-09-08 alongside the pitMetrics query-layer rebuild (confirmed live
// with bff-ts): it used to vary by field — daily/technical metrics gave a real "YYYY-MM-DD"
// trading date, quarterly-report-backed metrics (roe, altmanZScore, piotroskiFScore, etc.)
// instead gave a "{2-digit year}Q{season}" fiscal-quarter label like "26Q2". Now EVERY field
// returns a real "YYYY-MM-DD" date uniformly, no more fiscal-quarter strings. Still treated as
// an opaque display string here regardless — never parse/format it as a date —
// OrganismResultTable.vue only ever interpolates it directly, so this format change needed no
// code fix, only this comment update.
// value corrected to string | null 2026-09-02 — a live POST /screener/values response (used
// by the dashboard's 個股健檢 card) came back with the entry itself present but its value null
// (e.g. {value: null, knowledgeDate: "2026-08-11"} for a symbol with no computable Piotroski
// F-Score, distinct from the whole entry being absent below). OrganismResultTable.vue's own
// formatValue already handled this defensively (`raw: string | null | undefined`) despite the
// type here previously claiming value was never null — this just makes the type match what the
// code already assumed.
//
// Breaking change 2026-09-14 (relayed by analysis-ts, applies to POST /screener,
// GET /screener/ranking, POST /screener/values): `asOfDate` renamed to `knowledgeDate` (the old
// name was a naming mistake from the original rebuild — this value is "the day the market/
// filing disclosed this number," not "the day it took effect," and the rename brings it in line
// with every other PIT endpoint, e.g. metrics-history's own `knowledgeDate`). Also added
// `nullReason`, same 4-value enum as metrics-history
// (missing_input/zero_or_negative_denominator/not_applicable_industry/insufficient_history) —
// lets StockGuruBadgeDialog.vue finally tell "不適用" apart from a generic data gap, the
// same distinction StockHistoricalStatisticsTable.vue already had via metrics-history. Per
// analysis-ts's own caveat: `nullReason: null` here means EITHER "this period has a real value"
// OR "never computed at all" — these 3 endpoints can't tell the two apart (unlike
// metrics-history's own `entries` array, where a metric's absence from a period is visible
// structurally) — only trust nullReason when it's non-null.
export interface ScreenerFieldValue {
  value: string | null
  knowledgeDate: string
  nullReason: string | null
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
