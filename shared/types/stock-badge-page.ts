import type { StockBadgeEntry } from './stock-badges'
import type { MetricProvenanceResponse } from './metric-provenance'

// server/api/stock/[code]/badge.get.ts — everything one /stock/:code/{badge-slug} page
// (app/pages/stock/[code]/[slug].vue, 2026-09-20) needs in one same-origin round trip: the
// company's own value/pass-fail for the badge, and the calculation-audit table. Deliberately NOT
// folded into StockSeriesResponse/SERIES_PLANS: that interface is "one page name", this is "one
// page name × one badge" — forcing it in would make `page` a compound key for no benefit, since
// badge pages don't share series groups with anything else.
export interface StockBadgePageResponse {
  symbol: string
  slug: string
  // null when the symbol's own GET /stocks/:symbol/badges response doesn't carry this
  // metricCode — either the company is outside the badge's applicable population (nullReason on
  // a present entry handles that case instead) or analysis-ts has withdrawn the badge entirely
  // (see BADGE_PAGES's own comment on `findBadgePage`'s callers handling that gracefully).
  entry: StockBadgeEntry | null
  provenance: MetricProvenanceResponse | null
}
