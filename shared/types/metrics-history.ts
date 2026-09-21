// Wire shapes of bff-ts's GET /stocks/:symbol/metrics-history, shared by the app composables
// (useMetricsHistory.ts re-exports these) and the Nitro cache layer (server/utils/stock-data.ts).
// Lives under shared/ because server code can't import an app composable's types without pulling
// the composable's own auto-imported runtime names (useState/ref/watch) into the server type
// program — see the 2026-09-19 SEO build's Phase 0 notes in the plan file.

export interface MetricsHistoryPoint {
  value: number | null
  nullReason: string | null
  knowledgeDate: string
  knowledgeDateIsFallback: boolean
}

export interface MetricsHistoryEntry {
  fiscalYear: number
  fiscalQuarter: number
  // A metricCode with zero backfilled data for this specific period comes back as bare JSON
  // `null` for that key (not an object, not a missing key) — bff-ts 2026-09-10.
  values: Record<string, MetricsHistoryPoint | null>
}

// bff-ts's public query key for this is still literally `basis` (its own external contract),
// while every identifier in this app says timeframe — see useMetricsHistory.ts's own comment.
export type MetricsHistoryTimeframe = 'Q' | 'TTM' | 'FY'

// One cached/served series: the request that produced it (so a consumer can key a cache with it)
// plus bff-ts's ascending "last N periods" entries and the total periods it has for these codes.
export interface MetricsHistorySeries {
  timeframe: MetricsHistoryTimeframe
  codes: string[]
  limit: number
  entries: MetricsHistoryEntry[]
  total: number
}
