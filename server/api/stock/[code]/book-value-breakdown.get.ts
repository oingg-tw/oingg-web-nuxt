import type { StockBookValueBreakdownResponse } from '#shared/types/stock-equity-composition'

// GET /api/stock/:code/book-value-breakdown — 每股淨值逐年變動拆解，一個快取呼叫。
// 上游查無資料回空陣列而不是 404，所以這裡不需要 settle。
const LISTED_SYMBOL = /^\d{4}$/

export default defineEventHandler(async (event): Promise<StockBookValueBreakdownResponse> => {
  const code = getRouterParam(event, 'code') ?? ''
  if (!LISTED_SYMBOL.test(code)) throw createError({ statusCode: 400, statusMessage: 'code must be a four-digit listed symbol' })
  try {
    return await cachedBookValueBreakdown(code)
  } catch {
    // 上游 20 家抽驗有 2 家回「Could not reach the analysis service」，看起來是瞬時的。一頁的一個
    // 段落抓不到不該讓整頁 500——空陣列會讓那個段落自己不渲染。
    return { symbol: code, entries: [] }
  }
})
