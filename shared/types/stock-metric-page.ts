import type { MetricsHistorySeries } from './metrics-history'

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
}
