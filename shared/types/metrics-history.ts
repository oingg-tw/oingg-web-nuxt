// Wire shapes of 業務中台's GET /stocks/:symbol/metrics-history, shared by the app composables
// (useMetricsHistory.ts re-exports these) and the Nitro cache layer (server/utils/stock-data.ts).
// Lives under shared/ because server code can't import an app composable's types without pulling
// the composable's own auto-imported runtime names (useState/ref/watch) into the server type
// program — see the 2026-09-19 SEO build's Phase 0 notes in the plan file.

// 每一期的說明（2026-11-21，數據中台 c28cc6e，使用者 11-12 說「好」）：只有營業費用五支、三率、每股營業利益與其他收益及費損淨額帶 notes。
// 一則是代碼加參數，句子網站寫（periodNoteText，app/utils/metric-null-reason.ts）
export interface PeriodNote {
  code: string
  // operating_expense_not_itemized：total_only／other_expense_items／components_do_not_add_up／financial_industry_format，金額千元
  reason?: string
  unitemizedAmount?: number | null
  // large_net_other_income_expenses：其他收益及費損淨額（千元）、占營收 %（營收 ≤ 0 是 null）、營業利益率是否高過毛利率
  amount?: number | null
  ratioToRevenue?: number | null
  operatingMarginAboveGrossMargin?: boolean
  // financial_report_corrected／financial_report_restated（那一期的財報更正、重編）、monthly_revenue_corrected（月營收更正）：公告日 YYYY-MM-DD
  announcementDate?: string
}

// 沒有申報的期別（數據中台 A 批，2026-11-22）：no_filing 沒有申報 XBRL 財報、unsupported_format 財報格式還讀不到。
// 回應最上層的 absentPeriods，期別本身不在 entries 裡；withPeriodFacts（shared/utils/metrics-history.ts）把它補成帶原因的空格
export interface AbsentPeriod {
  fiscalYear: number
  fiscalQuarter: number | null
  nullReason: string
}

export interface MetricsHistoryPoint {
  value: number | null
  nullReason: string | null
  knowledgeDate: string
  knowledgeDateIsFallback: boolean
  notes?: PeriodNote[]
}

export interface MetricsHistoryEntry {
  fiscalYear: number
  // 2026-10-07 業務中台 f750e92：上游本來就可能是 null，業務中台 以前轉成 "null"／0／false，現在原樣傳 null（FY 列以前出來是 Q0）
  fiscalQuarter: number | null
  // A metricCode with zero backfilled data for this specific period comes back as bare JSON
  // `null` for that key (not an object, not a missing key) — 業務中台 2026-09-10.
  values: Record<string, MetricsHistoryPoint | null>
  // 那一期的財報更正、重編（數據中台 A 批，2026-11-22；FY 是第四季的）。只在 業務中台 的回應上，withPeriodFacts 把它併進每一格的 notes
  notes?: PeriodNote[]
}

// 業務中台's public query key for this is still literally `basis` (its own external contract),
// while every identifier in this app says timeframe — see useMetricsHistory.ts's own comment.
export type MetricsHistoryTimeframe = 'Q' | 'TTM' | 'FY'

// One cached/served series: the request that produced it (so a consumer can key a cache with it)
// plus 業務中台's ascending "last N periods" entries and the total periods it has for these codes.
export interface MetricsHistorySeries {
  timeframe: MetricsHistoryTimeframe
  codes: string[]
  limit: number
  entries: MetricsHistoryEntry[]
  total: number
}
