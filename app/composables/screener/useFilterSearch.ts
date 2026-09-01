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
// asOfDate's format itself varies by field (confirmed same day): daily/technical metrics
// (stock.price, per/pbr/dividendYield, ma/rsi/kd/atr, etc.) give a real "YYYY-MM-DD" trading
// date; quarterly-report-backed metrics (roe, grossMargin, altmanZScore, piotroskiFScore,
// nissimPenmanRnoa, etc.) give a "{2-digit year}Q{season}" fiscal-quarter label like "26Q2"
// instead — which fiscal quarter matters more than its exact period-end date there. Treat
// this as an opaque display string, never parse/format it as a date — OrganismResultTable.vue
// only ever interpolates it directly for exactly this reason.
export interface ScreenerFieldValue {
  value: string
  asOfDate: string
}

export interface ScreenerResultRow {
  symbol: string
  name: string
  // Keyed by the same `field` string as ScreenerResultColumn.field; null when the company
  // has no data for it (the entry itself, not just .value, per the confirmed contract).
  values: Record<string, ScreenerFieldValue | null>
}
