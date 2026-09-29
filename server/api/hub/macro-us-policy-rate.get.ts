import type { UsRateCyclePageData } from '#shared/types/hub'

// GET /api/hub/macro-us-policy-rate — the 聯準會升降息 page's one data call. Same thin shape as
// /api/hub/macro-policy-rate: one cached function, so the page and the sitemap read one source.
export default defineEventHandler(async (): Promise<UsRateCyclePageData> => getUsRateCycle())
