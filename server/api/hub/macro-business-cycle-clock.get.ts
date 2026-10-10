import type { BusinessCycleIndicatorPoint } from '#shared/types/hub'

// GET /api/hub/macro-business-cycle-clock — 景氣時鐘頁的資料：最近 25 個月（24 個月變動要多一個月當起點）。
// ponytail: 只送 25 個月；國發會基準日期的長期折線到了要畫 1982 年起時，再改成送完整歷史。
const MONTHS = 25

export default defineEventHandler(async (): Promise<BusinessCycleIndicatorPoint[]> => (await getBusinessCycleIndicators()).slice(-MONTHS))
