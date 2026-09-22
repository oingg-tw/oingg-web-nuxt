import { DUPONT_METRIC_CODES, type StockDupontPageResponse } from '#shared/types/stock-dupont-page'

// GET /api/stock/:code/dupont — the 杜邦分析 page's one data call (2026-09-22).
//
// Seven codes in ONE request（metrics-history takes up to 10）, so the whole page costs a single
// cached bff round trip — same shape as margins.get.ts and solvency.get.ts, and for the same extra
// reason those two have: fetching them together guarantees they cover identical periods, which a
// page whose entire subject is「these five multiply to that one」cannot do without.
//
// BOTH bases, TTM and Q（2026-09-22）— see the type file for why the page offers the toggle and why
// TTM stays the default. Two cached calls rather than one: the page switches with no refetch, and
// each basis is cached under its own key, so a visitor who never touches the toggle still costs
// exactly what they did before once both are warm.
//
// 20 periods (5 years), the depth「任何指標的歷史，放五年就好，足夠了」set for every page here.
const LISTED_SYMBOL = /^\d{4}$/
const HISTORY_LIMIT = 20

export default defineEventHandler(async (event): Promise<StockDupontPageResponse> => {
  const code = getRouterParam(event, 'code') ?? ''
  if (!LISTED_SYMBOL.test(code)) throw createError({ statusCode: 400, statusMessage: 'code must be a four-digit listed symbol' })

  // A history hiccup must degrade the page, never 500 it — the page decides what degrading means.
  // Independently per basis: one failing must not take the other down, since either alone is a
  // usable page.
  const [series, quarterlySeries] = await Promise.all([
    cachedMetricsHistory(code, 'TTM', DUPONT_METRIC_CODES, HISTORY_LIMIT).catch(() => null),
    cachedMetricsHistory(code, 'Q', DUPONT_METRIC_CODES, HISTORY_LIMIT).catch(() => null)
  ])

  return { symbol: code, series, quarterlySeries }
})
