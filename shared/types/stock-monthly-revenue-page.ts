// server/api/stock/[code]/monthly-revenue.get.ts — 月營收（2026-09-23,「個股瀏覽 要上月營收」）.
//
// The field notes below were written against bff-ts's own contract when app/composables/stock/
// useMonthlyRevenueHistory.ts was built（2026-09-07）and are carried over verbatim — that
// composable never had a consumer, because the data behind it did not exist yet: twse-ts's PROD
// held a single stray 2330 row, having read `t187ap05_P`（公開發行未上市）instead of `_L`（上市）.
// It was backfilled on 2026-09-23 to 58,024 rows over 2021-09 ～ 2026-08, at which point
// analysis-ts turned out to be reading twse's DEV database as well. Both fixed the same day;
// sampled 15 symbols afterwards, 14 return a full 60 months.
export interface MonthlyRevenueEntry {
  // 'YYYY-MM'.
  yearMonth: string
  reportDate: string
  industry: string
  // Bigint-serialised as strings in NT$ THOUSAND — parse to Number before charting, and never
  // treat as already-numeric. analysis-ts deliberately does not convert the unit, so the
  // conversion and the label have to agree on one side; this app does both in one place, the
  // page's own 億元 formatter.
  currentMonthRevenue: string
  lastYearSameMonthRevenue: string
  // Null for companies listed within the last year — there is no same month to compare against.
  // 226 rows market-wide（0.4%）. Passed through as null rather than zero by explicit agreement
  // with analysis-ts, so the chart can leave a real gap instead of drawing a fall to zero.
  yoyChangePercent: number | null
  // Null only on the series' earliest entry (no prior month) — bff-ts computes this themselves,
  // analysis-ts's source has no momChangePercent field at all.
  momChangePercent: number | null
  cumulativeRevenue: string
  cumulativeLastYearRevenue: string
  cumulativeChangePercent: number
  // The company's own filed revenue-variance explanation. A literal「無」means the company
  // explicitly reported nothing unusual; real null means no disclosure at all — bff-ts confirmed
  // these are two distinct states, so they must not collapse into one「沒有說明」case.
  note: string | null
}

// One point per month: the close of that month's last trading day. Reduced on the SERVER from the
// daily series, because the only endpoint that exists is a daily one — `interval` and `from` are
// both silently ignored（tested 2026-09-23: interval=monthly returned 1,300 daily rows）. Sending
// 1,300 rows to every visitor so the browser could do this arithmetic would be absurd; sixty
// points arrive instead.
export interface MonthEndClose {
  // 'YYYY-MM', so it joins to MonthlyRevenueEntry.yearMonth directly.
  yearMonth: string
  close: number
}

export interface StockMonthlyRevenuePageResponse {
  symbol: string
  // Ascending (oldest first), as bff-ts returns it. `null` when the read failed — the page
  // degrades and goes noindex rather than erroring, the same rule every page in this family holds.
  entries: MonthlyRevenueEntry[] | null
  // Same months, same order. Empty when the price read failed; the revenue half of the page does
  // not depend on it.
  monthEndCloses: MonthEndClose[]
}
