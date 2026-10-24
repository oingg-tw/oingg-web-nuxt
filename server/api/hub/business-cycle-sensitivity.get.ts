import type { BusinessCycleSensitivity } from '#shared/types/hub'

// GET /api/hub/business-cycle-sensitivity — /industries/sensitivity 的圖與表。
export default defineEventHandler(async (): Promise<BusinessCycleSensitivity> => getBusinessCycleSensitivity())
