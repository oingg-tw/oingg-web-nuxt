import type { SectorGrowthSummary } from '#shared/types/hub'

// GET /api/hub/sector-growth-summary — /industries/growth 的散佈圖與 /industries 表格的兩欄。
export default defineEventHandler(async (): Promise<SectorGrowthSummary> => getSectorGrowthSummary())
