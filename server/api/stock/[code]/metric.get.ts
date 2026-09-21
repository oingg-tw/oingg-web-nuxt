import type { StockMetricPageResponse } from '#shared/types/stock-metric-page'

// GET /api/stock/:code/metric?slug=eps — the 指標專頁 counterpart of badge.get.ts (2026-09-20).
// `slug` is checked against the METRIC_PAGES registry (shared/utils/hub-slugs.ts) that the page
// component and the sitemap handler also read, so an unknown slug means here what it means
// everywhere else: a real 404.
//
// 20 periods (5 years of TTM quarters) — trimmed 2026-09-21 from the original 40（「任何指標的歷史，
// 放五年就好，足夠了」）. Was deliberately the same depth 指標歷史's own TTM_CORE_40 group uses (a
// different table, this app's own 近10年 fundamentals target); that reasoning no longer applies to
// this page specifically — the 目前值 card's own interactive chart defaults to 近5年 anyway
// (useMetricHistoryChartWindow.ts), so this server-side fetch and that default now match exactly
// rather than fetching a superset the chart would have to project down from. A visitor who wants
// more can still pick 近8年 in the chart's own selector — that's a live client fetch beyond this
// page's own SSR depth, same as switching to 單季 already is.
//
// settle(): a history-endpoint hiccup must degrade the page, never 500 it. What "degrade" means
// is the page's call (noindex, a 尚無資料 line) — this route only reports what it found.
const LISTED_SYMBOL = /^\d{4}$/
const HISTORY_LIMIT = 20
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

  // The Q fetch is now UNCONDITIONAL (2026-09-21,「文案上單季優先」) — it used to run only for a
  // metricPage carrying a quarterlyGrowthMetricCode, i.e. only `eps`, because its only job was to
  // supply that one growth figure. Now the 單季 VALUE itself leads every metric page's lead
  // sentence and its <title>, so every page needs it, growth sibling or not. A metric with no Q
  // basis at all (dividendPayoutRatio/dividendCoverageRatio/shareholderYield) simply comes back
  // with zero entries and the page falls back to its TTM sentence — no need to know in advance
  // which metrics those are, and no second place to keep that list in sync.
  const [series, quarterly] = await Promise.all([
    settle(cachedMetricsHistory(code, metricPage.timeframe, [metricPage.metricCode], HISTORY_LIMIT)),
    settle(cachedMetricsHistory(
      code,
      'Q',
      metricPage.quarterlyGrowthMetricCode ? [metricPage.metricCode, metricPage.quarterlyGrowthMetricCode] : [metricPage.metricCode],
      QUARTERLY_LIMIT
    ))
  ])

  return { symbol: code, slug: metricPage.slug, series, quarterly }
})
