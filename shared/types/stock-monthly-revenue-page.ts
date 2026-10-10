// server/api/stock/[code]/monthly-revenue.get.ts — 月營收（2026-09-23,「個股瀏覽 要上月營收」）.
//
// The field notes below were written against bff-ts's own contract on 2026-09-07 (for a client composable that never
// had a consumer and is gone) and are carried over verbatim — the data behind them did not exist yet: twse-ts's PROD
// held a single stray 2330 row, having read `t187ap05_P`（公開發行未上市）instead of `_L`（上市）.
// It was backfilled on 2026-09-23 to 58,024 rows over 2021-09 ～ 2026-08, at which point
// analysis-ts turned out to be reading twse's DEV database as well. Both fixed the same day;
// sampled 15 symbols afterwards, 14 return a full 60 months.
export interface MonthlyRevenueEntry {
  // 'YYYY-MM'.
  yearMonth: string
  // 2026-10-07 bff-ts f750e92：上游本來就可能是 null，bff 以前轉成 "null"／0／false，現在原樣傳 null
  // 交易所的出表日，不是公司的公告日（2026-10-11 業務中台 a33b291 改名；2330 的 2026-08 營收 9/10 公告、9/17 出表）。
  // 要顯示的話標「出表日」，別寫「公告日」。
  generatedDate: string | null
  sectorName: string | null
  // Bigint-serialised as strings in NT$ THOUSAND — parse to Number before charting, and never
  // treat as already-numeric. analysis-ts deliberately does not convert the unit, so the
  // conversion and the label have to agree on one side; this app does both in one place, the
  // page's own 億元 formatter.
  currentMonthRevenue: string | null
  lastYearSameMonthRevenue: string | null
  // Null for companies listed within the last year — there is no same month to compare against.
  // 226 rows market-wide（0.4%）. Passed through as null rather than zero by explicit agreement
  // with analysis-ts, so the chart can leave a real gap instead of drawing a fall to zero.
  yoyChangePct: number | null
  // Null only on the series' earliest entry (no prior month) — bff-ts computes this themselves,
  // analysis-ts's source has no MoM field at all.
  // Field names: the *Pct forms since 2026-10-10（業務中台 18612f4; the *Percent aliases go away after we confirm）.
  momChangePct: number | null
  cumulativeRevenue: string | null
  cumulativeLastYearRevenue: string | null
  cumulativeChangePct: number
  // The company's own filed revenue-variance explanation. A literal「無」means the company
  // explicitly reported nothing unusual; real null means no disclosure at all — bff-ts confirmed
  // these are two distinct states, so they must not collapse into one「沒有說明」case.
  note: string | null
}

// One point per month: the MEAN of that month's daily closes.
//
// Not the month-end close, which is what this carried until 2026-09-23. The change came from
// looking at how 財報狗 draws the same comparison — their series is labelled 月均價 — and the reason
// holds up: a month's revenue is a FLOW over the whole month, so the price series beside it should
// cover the whole month too. A month-end close is a single day's snapshot, and comparing a month of
// trading against whatever happened on its last session is a granularity mismatch, not a styling
// choice. It also makes the line jump on whichever weekday a month happens to end on.
//
// Reduced on the SERVER, because the only endpoint that exists is a daily one —`interval` and
// `from` are both silently ignored（tested: interval=monthly returned 1,300 daily rows）. Sending
// 1,300 rows to every visitor so the browser could average them would be absurd; sixty points
// arrive instead.
export interface MonthlyPrice {
  // 'YYYY-MM', so it joins to MonthlyRevenueEntry.yearMonth directly.
  yearMonth: string
  // Mean of that month's daily closes.
  avgClose: number
}

export interface StockMonthlyRevenuePageResponse {
  symbol: string
  // Ascending (oldest first), as bff-ts returns it. `null` when the read failed — the page
  // degrades and goes noindex rather than erroring, the same rule every page in this family holds.
  entries: MonthlyRevenueEntry[] | null
  // Same months, same order. Empty when the price read failed; the revenue half of the page does
  // not depend on it.
  monthlyPrices: MonthlyPrice[]
}
