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
  // 真正的單位（"%"／"元"／"分"…）由 bff-ts 2026-09-09 起提供；之前每個欄位都是 unit: null，各處才長出自己寫死的單位表，現在都讀這裡。
  unit: string | null
}

// 2026-08-31 起 values[field] 是這個物件而不是字串：knowledgeDate 是這個數字所描述的申報期／交易日（不是查詢時間），同一回應
// 裡不同公司的同一欄可以是不同日期（某家還沒申報），不是 bug。2026-09-08 起一律是 "YYYY-MM-DD"（之前季報類指標給 "26Q2"）；
// 這裡只當不透明的顯示字串，不解析。
// value 是 string | null（2026-09-02 實測 POST /screener/values 會回 {value: null, knowledgeDate: ...}，跟整筆缺席不同）。
// 2026-09-14（analysis-ts，適用 POST /screener、GET /screener/ranking、POST /screener/values）：asOfDate 改名 knowledgeDate、
// 新增 nullReason（missing_input／zero_or_negative_denominator／not_applicable_industry／insufficient_history，同 metrics-history），
// 讓「不適用」跟一般缺資料分得開。注意 nullReason: null 可能是「有值」也可能是「從沒算過」——只信非 null 的 nullReason。
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
