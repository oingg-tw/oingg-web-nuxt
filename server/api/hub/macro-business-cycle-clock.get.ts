import type { BusinessCycleClockData } from '#shared/types/hub'

// GET /api/hub/macro-business-cycle-clock — 景氣時鐘頁的資料：1982 年起的完整指標（2026-10-18 起，讀者可以選看國發會認定的歷次循環；
// 之前只送最近 25 個月），加上循環表。循環表讀不到時給空陣列：次要資料不擋主圖，時鐘照樣能看最近 24 個月
export default defineEventHandler(async (): Promise<BusinessCycleClockData> => {
  const [points, cycles] = await Promise.all([getBusinessCycleIndicators(), settle(getBusinessCycleReferenceDates())])
  return { points, cycles: cycles ?? [] }
})
