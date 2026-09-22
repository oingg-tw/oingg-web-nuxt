import type { MarketEventsPageData } from '#shared/types/hub'

// GET /api/hub/macro-market-events — the 大事件年表 page's one data call. Same shape as every
// other /api/hub/* route: a thin handler over one cached function, so the page and the sitemap read
// the same source.
export default defineEventHandler(async (): Promise<MarketEventsPageData> => getMarketEvents())
