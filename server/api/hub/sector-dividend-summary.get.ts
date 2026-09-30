import type { SectorDividendSummaryPageData } from '#shared/types/hub'

// GET /api/hub/sector-dividend-summary — the /industries scatter's one data call.
export default defineEventHandler(async (): Promise<SectorDividendSummaryPageData> => getSectorDividendSummary())
