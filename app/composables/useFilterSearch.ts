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

export interface ScreenerResultRow {
  symbol: string
  // Keyed by the same `field` string as ScreenerResultColumn.field; values come back as
  // strings (the BFF avoids floats on the wire), null when the company has no data for it.
  values: Record<string, string | null>
}
