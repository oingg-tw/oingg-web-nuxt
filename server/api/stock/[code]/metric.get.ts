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

export default defineEventHandler(async (event): Promise<StockMetricPageResponse> => {
  const code = getRouterParam(event, 'code') ?? ''
  if (!LISTED_SYMBOL.test(code)) throw createError({ statusCode: 400, statusMessage: 'code must be a four-digit listed symbol' })

  const slug = getQuery(event).slug
  const metricPage = typeof slug === 'string' ? findMetricPage(slug) : null
  if (!metricPage) throw createError({ statusCode: 404, statusMessage: 'unknown metric page' })

  let series = null
  try {
    series = await cachedMetricsHistory(code, metricPage.timeframe, [metricPage.metricCode], HISTORY_LIMIT)
  } catch {
    series = null
  }

  return { symbol: code, slug: metricPage.slug, series }
})
