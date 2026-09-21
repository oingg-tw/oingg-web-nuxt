import type { MetricsHistorySeries } from './metrics-history'
import type { StockBadges } from './stock-badges'
import type { PiotroskiBreakdown } from './piotroski'
import type { DividendHistoryResponse } from './dividend-history'
import type { StockContextRank } from './stock-context'

// server/api/stock/[code]/series.get.ts — everything one /stock/:code sub-page needs from
// bff-ts's per-symbol endpoints in ONE same-origin round trip, served from Nitro's cache
// (2026-09-19, the SEO build). The page plans (which metric groups, how many periods, whether
// badges/breakdown/dividend history ride along) live on the server (server/utils/stock-data.ts);
// the client only names the page. Each group carries its own request parameters so
// useStockPageDigest can key the app's useState caches exactly the way the card composables will
// look them up.

export type StockSeriesPage = 'index' | 'company-health' | 'dividend' | 'metrics-history' | 'financial-statements' | 'f-score'

export interface StockSeriesResponse {
  symbol: string
  page: StockSeriesPage
  // Keyed by the server plan's group name; null when that one upstream call failed (the page
  // renders without it and the card's own client-side load() retries later).
  groups: Record<string, MetricsHistorySeries | null>
  badges?: StockBadges | null
  breakdown?: PiotroskiBreakdown | null
  dividendHistory?: DividendHistoryResponse | null
  // Market-wide company ranks the page quotes in its answer sentences（GET /screener/company-rank）.
  ranks?: StockContextRank[]
}
