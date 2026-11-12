import type { ShareholdingDistribution } from '#shared/types/screener-detail'

// GET /api/stock/:code/holders — 個股持有人結構（2026-11-12，使用者選的盤點第 1 項）：跟 ETF 的持有人結構同一支上游、同一份五組分法。
// 集保查無這一檔（上游 404）回空的，頁面說沒有資料；其他失敗照樣丟，交給讀取失敗彈窗
export default defineEventHandler(async (event): Promise<ShareholdingDistribution> => {
  const code = requireListedSymbol(event)
  return cachedShareholdingDistribution(code).catch((error: { statusCode?: number }) => {
    if (error?.statusCode === 404) return { weeks: [], latestLevels: [] }
    throw error
  })
})
