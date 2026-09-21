import type { RateCyclePageData } from '#shared/types/hub'

// GET /api/hub/rate-cycle — the 大盤走勢與央行升降息 page's one data call. Same shape as every
// other /api/hub/* route: a thin handler over one cached function, so the page and the sitemap
// read the same source.
export default defineEventHandler(async (): Promise<RateCyclePageData> => getRateCycle())
