import { DUPONT_METRIC_CODES, type StockDupontPageResponse } from '#shared/types/stock-dupont-page'

// GET /api/stock/:code/dupont — the 杜邦分析 page's one data call (2026-09-22).
//
// Seven codes in ONE request（metrics-history takes up to 10）, so the whole page costs a single
// cached bff round trip — same shape as margins.get.ts and solvency.get.ts, and for the same extra
// reason those two have: fetching them together guarantees they cover identical periods, which a
// page whose entire subject is「these five multiply to that one」cannot do without.
//
// TTM. See the type file for why that is a correctness choice and not a default — a single
// quarter's ROE read as an annual figure overstates it by about four times.
//
// 20 periods (5 years), the depth「任何指標的歷史，放五年就好，足夠了」set for every page here.
const LISTED_SYMBOL = /^\d{4}$/
const HISTORY_LIMIT = 20

export default defineEventHandler(async (event): Promise<StockDupontPageResponse> => {
  const code = getRouterParam(event, 'code') ?? ''
  if (!LISTED_SYMBOL.test(code)) throw createError({ statusCode: 400, statusMessage: 'code must be a four-digit listed symbol' })

  // A history hiccup must degrade the page, never 500 it — the page decides what degrading means.
  let series = null
  try {
    series = await cachedMetricsHistory(code, 'TTM', DUPONT_METRIC_CODES, HISTORY_LIMIT)
  } catch {
    series = null
  }

  return { symbol: code, series }
})
