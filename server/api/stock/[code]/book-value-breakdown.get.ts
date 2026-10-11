import type { StockBookValueBreakdownResponse } from '#shared/types/stock-equity-composition'

// GET /api/stock/:code/book-value-breakdown — 每股淨值逐年變動拆解，一個快取呼叫。
// 上游查無資料回空陣列而不是 404，所以這裡不需要 settle。

export default defineEventHandler(async (event): Promise<StockBookValueBreakdownResponse> => {
  const code = requireListedSymbol(event)
  // 讀不到就回錯誤（2026-10-11）：原本吞成空陣列，頁面會說「目前沒有可以拆解的申報資料」。這支是頁面裡獨立的一個
  // 請求，失敗只影響這一段，頁面把它交給全站讀取失敗彈窗重讀，不會讓整頁 500。
  return cachedBookValueBreakdown(code)
})
