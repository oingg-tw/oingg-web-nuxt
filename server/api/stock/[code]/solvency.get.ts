import { SOLVENCY_METRIC_CODES, type StockSolvencyPageResponse } from '#shared/types/stock-solvency-page'

// GET /api/stock/:code/solvency — the 償債能力比率 page's one data call (2026-09-21).
//
// Five codes in ONE request（metrics-history takes up to 10）, so the whole page costs a single
// cached 業務中台 round trip — same shape as margins.get.ts, and for the same reason: fetching them
// together also guarantees they cover identical periods.
//
// Q only. Every one of the five is Q-only in the catalog（`fields` is Q alone for each, measured
// rather than assumed）— these are balance-sheet snapshots, and a ratio of two point-in-time
// figures has no rolling-four-quarter form to offer.
//
// 40 periods (10 years, STOCK_CHART_HISTORY_LIMIT): 近10年 (exactly 40 quarters) can be picked since 2026-11-25, and since 2026-11-23 the start year matches the metric pages; the table still lists 5 years.

export default defineEventHandler(async (event): Promise<StockSolvencyPageResponse> => {
  const code = requireListedSymbol(event)

  // A history hiccup must degrade the page, never 500 it — the page decides what degrading means.
  const series = await settle(cachedMetricsHistory(code, 'Q', SOLVENCY_METRIC_CODES, STOCK_CHART_HISTORY_LIMIT))

  return { symbol: code, series }
})
