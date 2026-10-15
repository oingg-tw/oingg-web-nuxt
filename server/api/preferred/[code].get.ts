import type { PreferredPageResponse } from '#shared/types/screener-detail'

// GET /api/preferred/:code — 特別股個別頁（/screener/preferred/{代號}，2026-10-15）。原本頁面在瀏覽器端讀整份清單，
// 標題與內容要等 JavaScript 跑完才出現；現在伺服器端從快取的清單（28 檔）挑出這一檔，SSR 就有內容。
export default defineEventHandler(async (event): Promise<PreferredPageResponse> => {
  const code = (getRouterParam(event, 'code') ?? '').toUpperCase()
  // 四碼加一個字母，也有兩個字元的（2887Z1，2026-10-15 清單裡唯一一檔）
  if (!/^\d{4}[A-Z][A-Z0-9]?$/.test(code)) throw createError({ statusCode: 400, statusMessage: 'code must be a preferred-stock symbol' })
  const [list, quote] = await Promise.all([cachedPreferredStocks(), settle(cachedLatestClose(code))])
  const stock = list.find(entry => entry.symbol.toUpperCase() === code)
  if (!stock) throw createError({ statusCode: 404, statusMessage: 'unknown preferred stock' })
  return { stock, quote }
})
