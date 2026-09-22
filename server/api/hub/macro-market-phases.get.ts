import type { MarketEventsPageData } from '#shared/types/hub'

// GET /api/hub/macro-market-phases — the 市場階段 page's one data call. Same shape as every
// other /api/hub/* route: a thin handler over one cached function, so the page and the sitemap read
// the same source.
export default defineEventHandler(async (): Promise<MarketEventsPageData> => getMarketEvents())
