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
// `quarterly` only ever needs the latest period — 2, not 1, so a null-valued most-recent entry
// (found() still returns the row, values can be null) doesn't silently leave the page with
// nothing when the period before it is fine. A different, much shallower cache-key sibling of
// the STOCK_HISTORY_LIMIT fetch above, not a slice of it (different basis, always Q).
const QUARTERLY_LIMIT = 2

export default defineEventHandler(async (event): Promise<StockMetricPageResponse> => {
  const code = requireListedSymbol(event)

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
    settle(cachedMetricsHistory(code, metricPage.timeframe, [metricPage.metricCode, ...(metricPage.partMetricCodes ?? []), ...(metricPage.compareMetricCode ? [metricPage.compareMetricCode] : [])], STOCK_HISTORY_LIMIT)),
    settle(cachedMetricsHistory(
      code,
      'Q',
      metricPage.quarterlyGrowthMetricCode ? [metricPage.metricCode, metricPage.quarterlyGrowthMetricCode] : [metricPage.metricCode],
      QUARTERLY_LIMIT
    )),
    // 計算依據（2026-10-01）。不帶條件直接打。
    //
    // 當天的兩次變化都已經過去，寫下來免得下一個人照舊註解推論：上游早上的白名單是 117 支、
    // 14 支損益表逐行的每股指標不在裡面（那 14 頁因此沒有這張表）；analysis-ts 當天下午補到 164 支，
    // 我重量過**型錄 161 支的 `hasProvenance` 現在全部是 true、跟端點零筆不符**，所以不再有
    // 「打了一定 400」的指標。
    //
    // `hasProvenance` 可以讀，我們仍然不讀——理由是依賴方向而不是不信它：要讀就得讓這支多依賴
    // getMetricsCatalog，而那支在 server 層是刻意不帶型別的直通（見它自己的註解），並且會生出一個
    // 今天不存在的失敗分支（型錄讀失敗時要不要照打？兩個答案都有缺點）。而它恆為 true 之後，讀它
    // 連一次 400 都省不到了。
    //
    // 真正需要判斷的不是「打不打得到」而是「打到的數字對不對」——那道對帳在
    // StockMetricProvenanceSection 裡（溯源的值跟頁面講的值對不起來就不渲染），因為只有那裡
    // 同時看得到兩個數字。
    settle(cachedMetricProvenance(code, metricPage.metricCode))
  ])

  return { symbol: code, slug: metricPage.slug, series, quarterly, provenance }
})
