import type { StockMetricPageResponse } from '#shared/types/stock-metric-page'

// GET /api/stock/:code/metric?slug=eps — the 指標專頁 counterpart of badge.get.ts (2026-09-20).
// `slug` is checked against the METRIC_PAGES registry (shared/utils/hub-slugs.ts) that the page
// component and the sitemap handler also read, so an unknown slug means here what it means
// everywhere else: a real 404.
//
// 40 periods, the same depth 指標歷史's own TTM_CORE_40 group uses — deep enough to clear the
// 近10年 bar this app holds itself to for fundamentals (10 years of TTM quarters), and it is the
// natural cache-key sibling of that existing group rather than a second depth to reason about.
//
// settle(): a history-endpoint hiccup must degrade the page, never 500 it. What "degrade" means
// is the page's call (noindex, a 尚無資料 line) — this route only reports what it found.
const LISTED_SYMBOL = /^\d{4}$/
const HISTORY_LIMIT = 40
// `quarterly` only ever needs the latest period — 2, not 1, so a null-valued most-recent entry
// (found() still returns the row, values can be null) doesn't silently leave the page with
// nothing when the period before it is fine. A different, much shallower cache-key sibling of
// the HISTORY_LIMIT fetch above, not a slice of it (different basis, always Q).
const QUARTERLY_LIMIT = 2

async function settle<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise
  } catch {
    return null
  }
}

export default defineEventHandler(async (event): Promise<StockMetricPageResponse> => {
  const code = getRouterParam(event, 'code') ?? ''
  if (!LISTED_SYMBOL.test(code)) throw createError({ statusCode: 400, statusMessage: 'code must be a four-digit listed symbol' })

  const slug = getQuery(event).slug
  const metricPage = typeof slug === 'string' ? findMetricPage(slug) : null
  if (!metricPage) throw createError({ statusCode: 404, statusMessage: 'unknown metric page' })

  const [series, quarterly] = await Promise.all([
    settle(cachedMetricsHistory(code, metricPage.timeframe, [metricPage.metricCode], HISTORY_LIMIT)),
    metricPage.quarterlyGrowthMetricCode
      ? settle(cachedMetricsHistory(code, 'Q', [metricPage.metricCode, metricPage.quarterlyGrowthMetricCode], QUARTERLY_LIMIT))
      : Promise.resolve(null)
  ])

  return { symbol: code, slug: metricPage.slug, series, quarterly }
})
