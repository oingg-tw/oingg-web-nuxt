import type { ReitDetail, ReitDistribution, ReitPageResponse } from '#shared/types/screener-detail'
import type { ReitDailyNav } from '#shared/utils/reit-nav'

// GET /api/reit/:code — REITs 個別頁（/reit/{代號} 底下每個面向共用，2026-10-30）在伺服器端要的一切，SSR 就有內容。代號大小寫都收（網址是
// 小寫，業務中台要大寫）。基本資料讀不到就是這檔不存在（404，數據中台只認現在掛牌的）；每日淨值、收益分配讀不到只是那一段沒有資料。
// 每日淨值在這裡併成每月一列：MOPS 從 2006 年起每天一筆，整串送到瀏覽器太大
const REIT_SYMBOL = /^0\d{4}T$/

export default defineEventHandler(async (event): Promise<ReitPageResponse> => {
  const code = (getRouterParam(event, 'code') ?? '').toUpperCase()
  if (!REIT_SYMBOL.test(code)) throw createError({ statusCode: 400, statusMessage: 'code must be a REIT symbol' })
  const [reit, quote, navMonths, distributions] = await Promise.all([
    cachedReit(code).catch((error: { statusCode?: number }) => {
      if (error?.statusCode === 404) throw createError({ statusCode: 404, statusMessage: 'unknown REIT' })
      throw error
    }),
    settle(cachedLatestClose(code)),
    settle(cachedReitNavMonths(code)),
    settle(cachedReitDistributions(code))
  ])
  return { reit, quote, navMonths, distributions }
})

// 收盤價、淨值、分配一天變一次（業務中台也回 max-age=3600）
const cachedReit = defineCachedFunction(
  (symbol: string) => businessFetch<ReitDetail>(`/reits/${symbol}`),
  { name: 'reit-detail', getKey: (symbol: string) => symbol, maxAge: HOUR, staleMaxAge: TTL_STATIC, swr: true }
)
const cachedReitNavMonths = defineCachedFunction(
  async (symbol: string) => reitNavMonths((await businessFetch<{ entries: ReitDailyNav[] }>(`/reits/${symbol}/daily-nav`)).entries ?? []),
  { name: 'reit-nav-months', getKey: (symbol: string) => symbol, maxAge: 6 * HOUR, staleMaxAge: TTL_STATIC, swr: true }
)
const cachedReitDistributions = defineCachedFunction(
  async (symbol: string) => (await businessFetch<{ entries: ReitDistribution[] }>(`/reits/${symbol}/distributions`)).entries ?? [],
  { name: 'reit-distributions', getKey: (symbol: string) => symbol, maxAge: 6 * HOUR, staleMaxAge: TTL_STATIC, swr: true }
)
