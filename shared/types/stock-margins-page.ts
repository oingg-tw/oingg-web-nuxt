import type { MetricsHistorySeries } from './metrics-history'
import type { StockBadgeEntry } from './stock-badges'

// server/api/stock/[code]/margins.get.ts — everything /stock/:code/margins（財報三率, 2026-09-21）
// needs in one same-origin round trip.
//
// A THIRD page shape alongside StockMetricPageResponse and StockBadgePageResponse, not a variant
// of either, and for the reason those two are already separate: a metric page answers 現在多少/
// 以前多少 about ONE metric, a badge page answers 符合/未符合 against one threshold, and this page
// answers neither — it answers how three rates RELATE to each other down one income statement.
// That relationship is the page's whole content, and it needs five metricCodes read together per
// period, which neither of the other two responses can carry. Built as its own route file rather
// than a METRIC_PAGES entry for the same reason（its registry entry has a single `metricCode`）.
//
// Requested directly:「希望有頁面同時解釋 三率 的 關係」.
export interface StockMarginsPageResponse {
  symbol: string
  // Ascending (oldest first), as bff-ts returns it, with every code in MARGIN_METRIC_CODES in each
  // period's own `values`. `null` when the history endpoint failed — the page degrades to its
  // definition/link content and goes noindex rather than erroring, same rule as the metric page.
  series: MetricsHistorySeries | null
  // The 三率三升 badge for this symbol（2026-09-21,「三率三升的徽章可以加上去了」）— null when the
  // symbol has no reading, which as of this date is almost all of them: measured across 20 large
  // symbols, only 2330 carries any threeMarginsRising data at all（20 Q periods; the other 19
  // return no badge and an empty series）.
  //
  // That coverage is why this rides on the EXISTING 財報三率 page as one extra section instead of
  // becoming a badge page of its own: a BADGE_PAGES entry would put ~2,600 URLs into the sitemap
  // of which one has content, the same reason 月營收 is still held out of the nav. Here the
  // section simply doesn't render for a symbol with no reading, and lights up by itself as
  // analysis-ts's coverage grows — no code change waiting on it.
  threeMarginsRising: StockBadgeEntry | null
}

// The three rates themselves, in income-statement order (top to bottom) — this array's ORDER is
// what the chart's series order and the table's column order both read, so it is the one place
// that sequence is written down.
export const MARGIN_RATE_CODES = ['grossMargin', 'operatingMargin', 'netProfitMargin'] as const

// The two expense ratios that sit BETWEEN 毛利率 and 營業利益率, used only by the decomposition
// table. Both verified live against GET /metrics before this page was built: each has Q+TTM,
// hasProvenance: true, and a real series for every non-financial symbol sampled.
//
// operatingExpenseRatio is (推銷 + 管理) / 營收 — its own formulaLatex says so explicitly and
// measurement confirms it: 毛利率 − 營業費用率 − 研發費用率 ≈ 營業利益率 closes to ±0.01 on 6 of 7
// non-financial symbols sampled（2454 0.01, 1216 0.01, 1101 0.01, 2317 0.00, 3008 0.01, 1301 0.00;
// 2330 is 0.18, its 其他營業收益及費用 line）, whereas dropping rdIntensity leaves a residual equal
// to each company's R&D intensity（2330 5.89, 2454 25.82 — both match those companies' known R&D
// spend, 1216 0.17 for a food company with almost none）. So 研發 must be its own row here; it is
// NOT inside operatingExpenseRatio, despite what operatingMargin's own catalog `limitations` text
// currently says（reported to analysis-ts 2026-09-21）.
export const MARGIN_EXPENSE_CODES = ['operatingExpenseRatio', 'rdIntensity'] as const

export const MARGIN_METRIC_CODES: string[] = [...MARGIN_RATE_CODES, ...MARGIN_EXPENSE_CODES]

// GET /metrics' key for the 三率三升 badge. Deliberately not in MARGIN_METRIC_CODES above: that
// array is the history fetch's metricCode list, and this one is read from the BADGES endpoint
// instead (it carries the passed/threshold evaluation, which a raw series does not).
export const THREE_MARGINS_RISING_CODE = 'threeMarginsRising'
