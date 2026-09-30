import type { EcbRateCyclePageData } from '#shared/types/hub'

// GET /api/hub/macro-ecb-policy-rate — the 歐洲央行升降息 page's one data call, same thin shape as
// its CBC and Fed siblings.
export default defineEventHandler(async (): Promise<EcbRateCyclePageData> => getEcbRateCycle())
