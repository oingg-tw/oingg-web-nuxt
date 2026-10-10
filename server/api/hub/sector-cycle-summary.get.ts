import type { SectorCycleSummary } from '#shared/types/hub'

// GET /api/hub/sector-cycle-summary — /industries/cycle 的散佈圖與表格。
export default defineEventHandler(async (): Promise<SectorCycleSummary> => getSectorCycleSummary())
