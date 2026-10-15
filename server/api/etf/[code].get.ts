import type { EtfPageResponse } from '#shared/types/screener-detail'

// GET /api/etf/:code — ETF 個別頁（/screener/etf/{代號}，2026-10-15）在伺服器端要的一切：基本資料、最新收盤價、配息紀錄。
// 代號大小寫都收（網址是小寫，業務中台 要大寫）。基本資料讀不到就是這檔不存在（404），配息與股價讀不到只是那一段沒有資料。
const ETF_SYMBOL = /^\d{4,6}[A-Z]?$/

export default defineEventHandler(async (event): Promise<EtfPageResponse> => {
  const code = (getRouterParam(event, 'code') ?? '').toUpperCase()
  if (!ETF_SYMBOL.test(code)) throw createError({ statusCode: 400, statusMessage: 'code must be an ETF symbol' })
  const [etf, distributions, quote] = await Promise.all([
    cachedEtf(code).catch((error: { statusCode?: number }) => {
      if (error?.statusCode === 404) throw createError({ statusCode: 404, statusMessage: 'unknown ETF' })
      throw error
    }),
    settle(cachedEtfDistributions(code)),
    settle(cachedLatestClose(code))
  ])
  return { etf, distributions, quote }
})
