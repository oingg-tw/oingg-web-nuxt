import { SOLVENCY_METRIC_CODES, type StockSolvencyPageResponse } from '#shared/types/stock-solvency-page'

// GET /api/stock/:code/solvency — the 安全韌性的組成 page's one data call (2026-09-21).
//
// Five codes in ONE request（metrics-history takes up to 10）, so the whole page costs a single
// cached bff round trip — same shape as margins.get.ts, and for the same reason: fetching them
// together also guarantees they cover identical periods.
//
// Q only. Every one of the five is Q-only in the catalog（`fields` is Q alone for each, measured
// rather than assumed）— these are balance-sheet snapshots, and a ratio of two point-in-time
// figures has no rolling-four-quarter form to offer.
//
// 20 periods (5 years), the depth「任何指標的歷史，放五年就好，足夠了」set for every page here.
const LISTED_SYMBOL = /^\d{4}$/
const HISTORY_LIMIT = 20

export default defineEventHandler(async (event): Promise<StockSolvencyPageResponse> => {
  const code = getRouterParam(event, 'code') ?? ''
  if (!LISTED_SYMBOL.test(code)) throw createError({ statusCode: 400, statusMessage: 'code must be a four-digit listed symbol' })

  // A history hiccup must degrade the page, never 500 it — the page decides what degrading means.
  let series = null
  try {
    series = await cachedMetricsHistory(code, 'Q', SOLVENCY_METRIC_CODES, HISTORY_LIMIT)
  } catch {
    series = null
  }

  return { symbol: code, series }
})
