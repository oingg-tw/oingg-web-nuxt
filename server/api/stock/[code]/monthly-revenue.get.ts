import type { MonthEndClose, MonthlyRevenueEntry, StockMonthlyRevenuePageResponse } from '#shared/types/stock-monthly-revenue-page'

// GET /api/stock/:code/monthly-revenue — the 月營收 page's one data call（2026-09-23）.
//
// Its own cached read rather than the client composable that already existed（app/composables/
// stock/useMonthlyRevenueHistory.ts, now deleted）: the page is server-rendered like every other
// /stock/:code sub-page, so the figures have to be in the server HTML. That composable had no
// consumer in any case — it was written in 2026-09 against an endpoint whose data did not land
// until this week.
//
// 60 months, the full depth twse-ts backfilled（2021-09 ～ 2026-08）. Deliberately more than the
// five years of QUARTERS every other page here takes: five years of monthly points is sixty, and
// the whole reason to read a monthly series rather than a quarterly one is to see the shape within
// a year. Cutting it to twenty would leave under two years of seasons.
const LISTED_SYMBOL = /^\d{4}$/
const MONTHS = 60

interface MonthlyRevenueHistoryResponse {
  symbol: string
  entries: MonthlyRevenueEntry[]
}

interface DailyPriceResponse {
  entries: { tradeDate: string; close: number }[]
}

// Enough daily rows to reach back past the revenue series' own start. 1,300 trading days is a bit
// over five years（~245 a year）and measured to land on 2021-05 for 2330, comfortably before the
// revenue data begins at 2021-09.
const PRICE_ROWS = 1300

// The last trading day of each month wins. Walking the ascending series and overwriting keeps the
// last one seen per month, which is that month's close — no date arithmetic and no assumption
// about which weekday a month ends on（Taiwan had Saturday sessions once, and holidays move）.
function toMonthEndCloses(entries: { tradeDate: string; close: number }[]): MonthEndClose[] {
  const byMonth = new Map<string, number>()
  for (const entry of entries) byMonth.set(entry.tradeDate.slice(0, 7), entry.close)
  return [...byMonth.entries()].map(([yearMonth, close]) => ({ yearMonth, close })).sort((a, b) => a.yearMonth.localeCompare(b.yearMonth))
}

export default defineEventHandler(async (event): Promise<StockMonthlyRevenuePageResponse> => {
  const code = getRouterParam(event, 'code') ?? ''
  if (!LISTED_SYMBOL.test(code)) throw createError({ statusCode: 400, statusMessage: 'code must be a four-digit listed symbol' })

  // An empty list is a real answer, not a failure: 月營收 is filed by 上市 companies, so a TPEx or
  // newly-listed symbol legitimately has none（1 of a 15-symbol sample）. null, separately, means
  // the read itself failed — the page tells those two apart.
  // Independent reads: a price hiccup must not cost the reader the revenue table, and vice versa.
  const [revenue, prices] = await Promise.all([
    cachedMonthlyRevenue(code, MONTHS).catch(() => null),
    cachedMonthEndCloses(code).catch(() => [] as MonthEndClose[])
  ])

  return { symbol: code, entries: revenue?.entries ?? null, monthEndCloses: prices }
})

// Cached beside the route rather than in server/utils: it has exactly one caller, and the utils
// file is for reads more than one page shares.
const cachedMonthlyRevenue = defineCachedFunction(
  (symbol: string, limit: number) =>
    bffFetch<MonthlyRevenueHistoryResponse>(`/stocks/${symbol}/monthly-revenue-history`, { query: { limit } }),
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
// other — and cached at all because 1,300 daily rows is a heavy read to repeat per visitor when the
// answer only changes once a day.
const cachedMonthEndCloses = defineCachedFunction(
  async (symbol: string): Promise<MonthEndClose[]> => {
    const response = await bffFetch<DailyPriceResponse>(`/stocks/${symbol}/daily-price-history`, { query: { limit: PRICE_ROWS } })
    return toMonthEndCloses(response.entries ?? [])
  },
  {
    name: 'stock-month-end-closes',
    getKey: symbol => symbol,
    maxAge: 6 * 60 * 60,
    staleMaxAge: 24 * 60 * 60,
    swr: true
  }
)
