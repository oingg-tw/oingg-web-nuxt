import type { DividendHistoryResponse } from '#shared/types/dividend-history'
import type { EtfDistributions, EtfLiquidityMonth, EtfPageResponse } from '#shared/types/screener-detail'

// GET /api/etf/:code — ETF 個別頁（/etf/{代號} 底下每個面向共用，2026-10-15；10-18 從 /screener/etf 搬來並拆成面向）在伺服器端要的一切：
// 基本資料、最新收盤價、配息紀錄，以及從日線算的填息與每月成交。代號大小寫都收（網址是小寫，業務中台 要大寫）。基本資料讀不到就是這檔
// 不存在（404），其餘讀不到只是那一段沒有資料。
const ETF_SYMBOL = /^\d{4,6}[A-Z]?$/

// 填息沿用個股的 computeDividendFills：ETF 的配息就是現金、沒有股票股利，轉成同一個形狀
const asDividendHistory = (distributions: EtfDistributions | null): DividendHistoryResponse | null => (distributions
  ? { entries: [{ events: distributions.events.flatMap(event => (event.distributionPerUnit === null ? [] : [{ exDividendDate: event.exDividendDate, cashDividend: event.distributionPerUnit, stockDividend: null }])) }] } as DividendHistoryResponse
  : null)

// 每月日均成交。只算有成交的日子（cachedDailyCloses 已去掉收盤 0 的無成交日）；成交量 null 的日子不算
// ponytail: ETF 幾乎天天有成交，無成交日不計入分母；要給冷門 ETF 看「幾天沒成交」時再把那些日子算進來
function monthlyLiquidity(daily: { tradeDate: string; close: number; volume?: number | null }[]): EtfLiquidityMonth[] {
  const months = new Map<string, { days: number; value: number; shares: number }>()
  for (const day of daily) {
    if (day.volume === null || day.volume === undefined) continue
    const month = day.tradeDate.slice(0, 7)
    const bucket = months.get(month) ?? { days: 0, value: 0, shares: 0 }
    bucket.days += 1
    bucket.value += day.close * day.volume
    bucket.shares += day.volume
    months.set(month, bucket)
  }
  return [...months].map(([month, { days, value, shares }]) => ({
    month,
    tradingDays: days,
    averageDailyValue: Math.round(value / days),
    averageDailyLots: Math.round(shares / days / 1000)
  }))
}

export default defineEventHandler(async (event): Promise<EtfPageResponse> => {
  const code = (getRouterParam(event, 'code') ?? '').toUpperCase()
  if (!ETF_SYMBOL.test(code)) throw createError({ statusCode: 400, statusMessage: 'code must be an ETF symbol' })
  const [etf, distributions, quote, daily, monthly, premium, holders] = await Promise.all([
    cachedEtf(code).catch((error: { statusCode?: number }) => {
      if (error?.statusCode === 404) throw createError({ statusCode: 404, statusMessage: 'unknown ETF' })
      throw error
    }),
    settle(cachedEtfDistributions(code)),
    settle(cachedLatestClose(code)),
    settle(cachedDailyCloses(code)),
    settle(cachedEtfMonthlyHistory(code)),
    settle(cachedEtfPremiumMonths(code)),
    settle(cachedEtfHolders(code))
  ])
  return {
    etf,
    distributions,
    quote,
    fills: daily?.length ? computeDividendFills(asDividendHistory(distributions), daily) : null,
    liquidity: daily?.length ? monthlyLiquidity(daily) : null,
    monthly: monthly?.length ? monthly : null,
    premium: premium?.length ? premium : null,
    holders: holders?.weeks.length ? holders : null
  }
})
