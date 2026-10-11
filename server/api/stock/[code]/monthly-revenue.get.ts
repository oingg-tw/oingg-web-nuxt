import type { MonthlyPrice, MonthlyRevenueEntry, StockMonthlyRevenuePageResponse } from '#shared/types/stock-monthly-revenue-page'

// GET /api/stock/:code/monthly-revenue — the 月營收 page's one data call（2026-09-23）.
//
// 自己做快取讀取、在伺服器端取數（頁面跟其他 /stock/:code 子頁一樣是 SSR，數字要在伺服器 HTML 裡）；2026-09 寫的用戶端
// composable 從沒有消費者，已刪。
//
// 132 個月＝業務中台與 analysis-ts 的上限（2026-10-11 起；2026-10-10 月營收由 mops-ts 回補到 2016-01，實測 2330 等
// 128 個月）。比其他頁的季頻多得多是刻意的：讀月頻就是要看一年之內的形狀，而退休讀者要看完整的景氣循環。
const MONTHS = 132

interface MonthlyRevenueHistoryResponse {
  symbol: string
  entries: MonthlyRevenueEntry[]
}

interface DailyPriceResponse {
  entries: { tradeDate: string; close: number }[]
}

// 日線用 `from` 取（業務中台 1d61683／analysis-ts，2026-10-11）：從月營收那一段的第一個月月初起，不設筆數上限
//（實測 2330 from=2016-01-01 回 2,623 筆）。原本 limit 上限 2000 只到 2018-07，月營收的前兩年半沒有月均價。
// 起點跟 MONTHS 綁在一起：往回 MONTHS−1 個月的月初。from 與 limit 不能同時給。
function priceFrom(): string {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS - 1), 1))
  return start.toISOString().slice(0, 10)
}

// The MEAN of each month's daily closes — see MonthlyPrice's own comment for why an average rather
// than the month-end close. Every session in the month counts equally, including the Saturday ones
// Taiwan used to hold, so nothing here assumes how many trading days a month has or which weekday
// it ends on.
function toMonthlyPrices(entries: { tradeDate: string; close: number }[]): MonthlyPrice[] {
  const byMonth = new Map<string, { sum: number; count: number }>()
  for (const entry of entries) {
    const key = entry.tradeDate.slice(0, 7)
    const bucket = byMonth.get(key) ?? { sum: 0, count: 0 }
    bucket.sum += entry.close
    bucket.count += 1
    byMonth.set(key, bucket)
  }
  return [...byMonth.entries()]
    .map(([yearMonth, { sum, count }]) => ({ yearMonth, avgClose: sum / count }))
    .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth))
}

export default defineEventHandler(async (event): Promise<StockMonthlyRevenuePageResponse> => {
  const code = requireListedSymbol(event)

  // An empty list is a real answer, not a failure: 興櫃 and newly-listed symbols legitimately have none
  //（2026-10-11 實測：興櫃 5／5 檔 0 筆，上櫃 1264／1294／1295 各有 128／65／49 個月）. null, separately, means
  // the read itself failed — the page tells those two apart.
  // Independent reads: a price hiccup must not cost the reader the revenue table, and vice versa.
  const [revenue, prices] = await Promise.all([settle(cachedMonthlyRevenue(code, MONTHS)), settle(cachedMonthlyPrices(code))])

  return { symbol: code, entries: revenue?.entries ?? null, monthlyPrices: prices ?? [] }
})

// Cached beside the route rather than in server/utils: it has exactly one caller, and the utils
// file is for reads more than one page shares.
const cachedMonthlyRevenue = defineCachedFunction(
  (symbol: string, limit: number) =>
    businessFetch<MonthlyRevenueHistoryResponse>(`/stocks/${symbol}/monthly-revenue-history`, { query: { limit } }),
  {
    name: 'stock-monthly-revenue',
    getKey: (symbol, limit) => `${symbol}:${limit}`,
    // Monthly data changes once a month, on the 10th — a day's staleness is invisible and the
    // whole market re-reading it on the same morning is not.
    maxAge: 6 * 60 * 60,
    staleMaxAge: 24 * 60 * 60,
    swr: true
  }
)

// The price half. Cached separately from the revenue half so a re-read of one does not re-fetch the
// other — and cached at all because ~2,600 daily rows is a heavy read to repeat per visitor when the
// answer only changes once a day.
const cachedMonthlyPrices = defineCachedFunction(
  async (symbol: string): Promise<MonthlyPrice[]> => {
    const response = await businessFetch<DailyPriceResponse>(`/stocks/${symbol}/daily-price-history`, { query: { from: priceFrom() } })
    // 無成交日的 close 是 0，會把月均價拉低——見 stock-data.ts 的 isRealClose 註解。
    return toMonthlyPrices((response.entries ?? []).filter(isRealClose))
  },
  {
    name: 'stock-monthly-prices',
    getKey: symbol => symbol,
    maxAge: 6 * 60 * 60,
    staleMaxAge: 24 * 60 * 60,
    swr: true
  }
)
