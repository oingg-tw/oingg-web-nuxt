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
  const [series, quarterly, provenance] = await Promise.all([
    // 母項與成分同一次取回（2026-09-28 的組成段）。metrics-history 一次最多 10 支，而最長的一組是
    // 營業費用的 1＋4——不設上限檢查是因為登記表就在同一個檔案裡，加到第十支會在這裡 400，當場看得到。
    // 併在同一次還有一個不只是省請求的理由：成分與母項必須是**同一個快取世代**，分兩次取有機會拿到
    // 重算前後各一半，那時候恆等式會假性失敗，而畫面看起來完全正常。
    settle(cachedMetricsHistory(code, metricPage.timeframe, [metricPage.metricCode, ...(metricPage.partMetricCodes ?? []), ...(metricPage.compareMetricCode ? [metricPage.compareMetricCode] : [])], HISTORY_LIMIT)),
    settle(cachedMetricsHistory(
      code,
      'Q',
      metricPage.quarterlyGrowthMetricCode ? [metricPage.metricCode, metricPage.quarterlyGrowthMetricCode] : [metricPage.metricCode],
      QUARTERLY_LIMIT
    )),
    // 計算依據（2026-10-01）。不帶條件直接打：上游有一份 117 支的白名單，不在名單上的回 400
    // （實測 14 支損益表逐行的每股指標：每股毛利、每股營業利益、每股推銷費用…），settle() 吃掉它、
    // 那一段不渲染。
    //
    // **`GET /metrics` 的 `hasProvenance` 欄位可以拿來先擋掉那 14 次請求，我們刻意不讀。**
    // 那個欄位是可靠的：2026-10-01 對型錄裡全部 161 支各實打一次端點比對，零分歧（bff-ts 說它推導
    // 自端點白名單的同一個常數，所以是結構性的不是巧合）。不讀的理由不是不信它，是依賴方向——
    // 要讀就得讓這支多依賴 getMetricsCatalog，而那支在 server 層是刻意不帶型別的直通（見它自己的
    // 註解），並且會生出一個今天不存在的失敗分支：型錄讀失敗時要不要照打？兩個答案都有缺點。
    // 14 次毫秒級的 400（bff 的驗證不碰資料庫）比四行程式加一個跨快取依賴便宜。
    //
    // 上游補齊那 14 支的那天，這裡什麼都不用改，表格自己出現。
    settle(cachedMetricProvenance(code, metricPage.metricCode))
  ])

  return { symbol: code, slug: metricPage.slug, series, quarterly, provenance }
})
