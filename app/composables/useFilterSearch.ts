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
export interface ScreenerFieldValue {
  value: string
  asOfDate: string
}

export interface ScreenerResultRow {
  symbol: string
  // Keyed by the same `field` string as ScreenerResultColumn.field; null when the company
  // has no data for it (the entry itself, not just .value, per the confirmed contract).
  values: Record<string, ScreenerFieldValue | null>
}
