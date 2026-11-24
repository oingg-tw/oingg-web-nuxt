import type { MarginHistory, MarginTradingPage } from '#shared/utils/trading-flows'

// GET /api/stock/:code/margin-trading：信用交易頁（2026-11-24）。業務中台的 margin-history 讀 10 年（約 2,600 天、470 KB），在這裡併成
// 每月月底一列給圖、最近 10 天給表，瀏覽器不收每天的那一大份。收盤後才更新，快取一小時，最多再用舊的 6 小時
const cachedMarginTrading = defineCachedFunction(
  async (symbol: string): Promise<MarginTradingPage> => {
    const history = await businessFetch<MarginHistory>(`/stocks/${symbol}/margin-history`, { query: { from: `${new Date().getUTCFullYear() - 10}-01-01` } })
    return { market: history.market, latest: history.latest, sblShortBalanceSource: history.sblShortBalanceSource, months: marginMonths(history.entries), recent: recentDays(history.entries) }
  },
  { name: 'stock-margin-trading', getKey: (symbol: string) => symbol, ...swrCache(HOUR, 6 * HOUR) }
)

export default defineEventHandler(event => cachedMarginTrading(requireListedSymbol(event)))
