import type { PreferredPageResponse } from '#shared/types/screener-detail'

// GET /api/preferred/:code — 特別股個別頁（/preferred/{代號} 底下四個面向共用，2026-10-15；10-18 從 /screener/preferred 搬來）。伺服器端從快取的清單
//（28 檔）挑出這一檔，SSR 就有內容。實際配息（2026-10-18 從已拆掉的特別股專區搬來）：特別股的 dividend-history 從 2026-10-05 起 cashDividend 是
// 真的特別股股息（業務中台），深度 0～8 年，依除息日的年份加總；讀不到就是 null，不讓整頁失敗。
export default defineEventHandler(async (event): Promise<PreferredPageResponse> => {
  const code = (getRouterParam(event, 'code') ?? '').toUpperCase()
  // 四碼加一個字母，也有兩個字元的（2887Z1，2026-10-15 清單裡唯一一檔）
  if (!/^\d{4}[A-Z][A-Z0-9]?$/.test(code)) throw createError({ statusCode: 400, statusMessage: 'code must be a preferred-stock symbol' })
  const [list, quote, history] = await Promise.all([cachedPreferredStocks(), settle(cachedLatestClose(code)), settle(cachedDividendHistory(code))])
  const stock = list.find(entry => entry.symbol.toUpperCase() === code)
  if (!stock) throw createError({ statusCode: 404, statusMessage: 'unknown preferred stock' })
  let dividendsByYear: Record<string, number> | null = null
  if (history) {
    dividendsByYear = {}
    for (const year of history.entries ?? []) {
      for (const dividend of year.events ?? []) {
        if (!dividend.exDividendDate || !dividend.cashDividend) continue
        const key = dividend.exDividendDate.slice(0, 4)
        dividendsByYear[key] = Number(((dividendsByYear[key] ?? 0) + dividend.cashDividend).toFixed(6))
      }
    }
  }
  return { stock, quote, dividendsByYear }
})
