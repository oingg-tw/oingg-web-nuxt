import type { CashDividendPoint, DividendYieldPoint, StockDividendYieldHistoryResponse } from '#shared/types/stock-dividend-yield-history'

// GET /api/stock/:code/dividend-yield-history — 配股配息頁第一段「先跟自己比」的殖利率歷史（2026-10-15）。在伺服器端取，
// 答句裡「這檔自己的區間」要在 SSR 的 HTML 裡。抓 10 年：近N年選單最長是近8年，多的兩年給自訂區間。
// 同一支也帶每一次的現金股利（圖上的柱子），配股配息頁與指標速覽都只要讀這一支。
// 2026-10-25 改讀自算的現金殖利率（metricCode=liveCashDividendYield，analysis-ts 25845b3b、業務中台 9cf8622），跟篩選、排行同一支；
// 快取名稱跟著換，舊的交易所值不會被讀到
const LOOKBACK_YEARS = 10

const cachedDividendYieldHistory = defineCachedFunction(
  (symbol: string) =>
    businessFetch<{ entries: DividendYieldPoint[] }>(`/stocks/${symbol}/dividend-yield-history`, { query: { lookbackYears: LOOKBACK_YEARS, metricCode: 'liveCashDividendYield' } }),
  {
    name: 'stock-live-cash-dividend-yield-history',
    getKey: symbol => symbol,
    // 月底取樣，最新一點每天變一次；上游自己是 max-age=3600
    maxAge: 60 * 60,
    staleMaxAge: 24 * 60 * 60,
    swr: true
  }
)

export default defineEventHandler(async (event): Promise<StockDividendYieldHistoryResponse> => {
  const code = requireListedSymbol(event)
  const [response, dividends] = await Promise.all([settle(cachedDividendYieldHistory(code)), settle(cachedDividendHistory(code))])
  const cashDividends: CashDividendPoint[] = (dividends?.entries ?? [])
    .flatMap(entry => entry.events ?? [])
    .flatMap(event => (event.exDividendDate && (event.cashDividend ?? 0) > 0 ? [{ exDividendDate: event.exDividendDate, cashDividend: event.cashDividend! }] : []))
    .sort((a, b) => a.exDividendDate.localeCompare(b.exDividendDate))
  // 2020-09 以前股利公告不齊、是 null（insufficient_history）：前面整段空值拿掉，圖、近N年與「自己的區間」都從第一個有值的月開始
  const entries = response?.entries ?? []
  const first = entries.findIndex(entry => entry.value !== null)
  return { symbol: code, entries: response ? (first < 0 ? [] : entries.slice(first)) : null, cashDividends }
})
