import type { RateCyclePageData } from '#shared/types/hub'

// GET /api/hub/macro-policy-rate — the 政策利率與大盤 page's one data call. Same shape as every
// other /api/hub/* route: a thin handler over one cached function, so the page and the sitemap
// read the same source.
export default defineEventHandler(async (): Promise<RateCyclePageData> => getRateCycle())
