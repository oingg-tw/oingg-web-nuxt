import { MARGIN_METRIC_CODES, THREE_MARGINS_RISING_CODE, type StockMarginsPageResponse } from '#shared/types/stock-margins-page'

// GET /api/stock/:code/margins — the 財報三率 page's one data call (2026-09-21).
//
// Simpler than its two siblings (metric.get.ts / badge.get.ts) because it has no slug to resolve:
// this route serves exactly one page, so the metricCode set is fixed and lives in the shared type
// file the page component reads too. Five codes in ONE request — metrics-history takes up to 10
// per call, so the whole page costs a single bff round trip, cached like every other read here.
//
// 20 periods (5 years of TTM quarters), the same depth and for the same reason as metric.get.ts:
//「任何指標的歷史，放五年就好，足夠了」(2026-09-21).
//
// Q（單季）, one basis only — changed from TTM on 2026-09-21 along with every other metric default
// in this app（「請讓指標預設只用單季數字」, reason given: search behaviour）. Verified before
// switching that the decomposition this page is built on still closes at Q basis, not just at TTM:
// 毛利率 − 推銷管理費用率 − 研發費用率 lands within 0.00–0.41 of 營業利益率 across 2330/2454/1216/
// 1301/2317, the same 其他營業損益 residual the table shows as its own row. A basis where the
// identity did NOT close would have made this page's whole subject wrong, so it was measured
// rather than assumed.
//
// One basis rather than a 單季/近四季 toggle: this page's subject is the RELATIONSHIP between the
// three rates, and the per-rate pages each carry their own basis toggle for reading one rate at a
// different cadence.
//
// settle(): a history hiccup must degrade the page, never 500 it — the page decides what degrading
// means (noindex, a 尚無資料 line), this route only reports what it found.
const LISTED_SYMBOL = /^\d{4}$/
const HISTORY_LIMIT = 20

async function settle<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise
  } catch {
    return null
  }
}

export default defineEventHandler(async (event): Promise<StockMarginsPageResponse> => {
  const code = getRouterParam(event, 'code') ?? ''
  if (!LISTED_SYMBOL.test(code)) throw createError({ statusCode: 400, statusMessage: 'code must be a four-digit listed symbol' })

  // Two independent reads, neither allowed to take the page down with it — settle() rather than a
  // bare Promise.all, same rule metric.get.ts states: a backend hiccup degrades this page, it
  // never 500s it.
  const [series, badges] = await Promise.all([
    settle(cachedMetricsHistory(code, 'Q', MARGIN_METRIC_CODES, HISTORY_LIMIT)),
    settle(cachedBadges(code))
  ])

  // The badges response groups by category, and 三率三升 sits under 成長動能 rather than 獲利能力
  // where its three inputs live — so this searches every category instead of assuming one.
  const threeMarginsRising = badges?.categories
    .flatMap(category => category.badges)
    .find(badge => badge.metricCode === THREE_MARGINS_RISING_CODE) ?? null

  return { symbol: code, series, threeMarginsRising }
})
