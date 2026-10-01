import type { MetricsHistorySeries } from './metrics-history'
import type { MetricProvenanceResponse } from './metric-provenance'

// server/api/stock/[code]/metric.get.ts — everything one /stock/:code/{metric-slug} page
// (StockMetricDetailPage.vue, 2026-09-20) needs in one same-origin round trip.
//
// The deliberate counterpart of StockBadgePageResponse, not an extension of it: a badge page
// answers 符合/未符合 against a published threshold and shows the calculation audit behind that
// one number, while a metric page answers 現在多少/以前多少 and has no threshold to judge against
// at all. Keeping the two responses separate is what lets each page's template stay free of
// `v-if="isBadge"` branching — the same split the two registries in hub-slugs.ts make.
export interface StockMetricPageResponse {
  symbol: string
  slug: string
  // Ascending (oldest first), as bff-ts returns it. `null` when the history endpoint failed —
  // the page degrades to its definition sections and goes noindex rather than erroring, since a
  // metric page with no numbers has nothing symbol-specific to say.
  series: MetricsHistorySeries | null
  // The "this quarter vs. the same quarter last year" pair (2026-09-21) — always Q basis
  // regardless of `series`' own timeframe, and only fetched when METRIC_PAGES' own
  // quarterlyGrowthMetricCode is set. carries BOTH the metric's own Q-basis value and its
  // growth-rate sibling's value in one series (metrics-history accepts multiple metricCodes per
  // basis in one call), so this is one extra round trip regardless of how many quarterly facts
  // end up read from it. null on metrics without a declared growth sibling, same as `series` on
  // a fetch failure.
  quarterly: MetricsHistorySeries | null
  // 計算依據（審計鏈），2026-10-01 加上（「eps 沒有怎麼算出來的稽核表格又是為什麼?」）。徽章頁一直
  // 有這張表、46 個指標頁一直沒有，而資料是同一個端點。
  //
  // 上游的 metric-provenance 有一份 117 支的白名單，**14 支損益表逐行的每股指標不在裡面**
  //（grossProfitPerShare、operatingIncomePerShare、sellingExpensePerShare… 2026-10-01 實測全部 400），
  // 所以那 14 頁拿到 null、不渲染這一段。已開需求；上游補上的那天這裡不用改一個字。
  provenance: MetricProvenanceResponse | null
}
