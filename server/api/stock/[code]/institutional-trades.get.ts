import type { InstitutionalTrades, InstitutionalTradesPage } from '#shared/utils/trading-flows'

// GET /api/stock/:code/institutional-trades：三大法人頁（2026-11-24）。上櫃才有資料（櫃買，2014 起）；上市回空的、source 是 null
//（證交所的個股三大法人只在網站上，等公司成立後去信詢問）。同信用交易頁：10 年併成每月加總給圖、最近 10 天給表
const cachedInstitutionalTrades = defineCachedFunction(
  async (symbol: string): Promise<InstitutionalTradesPage> => {
    const trades = await businessFetch<InstitutionalTrades>(`/stocks/${symbol}/institutional-trades`, { query: { from: `${new Date().getUTCFullYear() - 10}-01-01` } })
    return { market: trades.market, source: trades.source, months: institutionalMonths(trades.entries), recent: recentDays(trades.entries) }
  },
  { name: 'stock-institutional-trades', getKey: (symbol: string) => symbol, ...swrCache(HOUR, 6 * HOUR) }
)

export default defineEventHandler(event => cachedInstitutionalTrades(requireListedSymbol(event)))
