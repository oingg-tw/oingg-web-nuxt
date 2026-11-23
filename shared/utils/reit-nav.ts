// REITs 每日淨值（數據中台 GET /reits/{symbol}/daily-nav，2026-10-30）併成每月一列：月底那天的收盤價與淨值，當月折溢價的平均、最高、最低
// （同 ETF 的每月折溢價）。tradeDate 是淨值日；那天沒成交時 close 與 premiumDiscountPct 是 null，不算進折溢價。被
// scripts/check-reit-nav.mjs 直接 import，所以零 import
export interface ReitDailyNav {
  tradeDate: string
  nav: number | null
  close: number | null
  premiumDiscountPct: number | null
}

export interface ReitNavMonthRow {
  month: string
  close: number | null
  nav: number | null
  tradingDays: number
  premiumAverage: number | null
  premiumHighest: number | null
  premiumLowest: number | null
}

const lastValue = (days: ReitDailyNav[], key: 'close' | 'nav') => days.findLast(day => day[key] !== null)?.[key] ?? null

export function reitNavMonths(entries: ReitDailyNav[]): ReitNavMonthRow[] {
  const sorted = [...entries].sort((a, b) => a.tradeDate.localeCompare(b.tradeDate))
  return [...Map.groupBy(sorted, day => day.tradeDate.slice(0, 7))].map(([month, days]) => {
    const premiums = days.flatMap(day => (day.premiumDiscountPct === null ? [] : [day.premiumDiscountPct]))
    return {
      month,
      close: lastValue(days, 'close'),
      nav: lastValue(days, 'nav'),
      tradingDays: premiums.length,
      premiumAverage: premiums.length ? Math.round((premiums.reduce((sum, value) => sum + value, 0) / premiums.length) * 100) / 100 : null,
      premiumHighest: premiums.length ? Math.max(...premiums) : null,
      premiumLowest: premiums.length ? Math.min(...premiums) : null
    }
  })
}

// 成交量（2026-11-23，對照 S-REITs 指南之後先做的流動性）：每日行情（GET /stocks/{symbol}/daily-price-history）併成每月一列。上游每個
// 交易日都有一列，沒成交的那天 close 是 null（有時帶幾百股零股的 volume，不算）。日均除以當月全部交易日、沒成交的日子算 0：台灣 REITs
// 2022 年有一個月 22 個交易日裡 13 天沒成交（01004T，2026-11 量的），只除有成交的日子（ETF 的算法）會把那種月份算得像天天有人買賣
export interface ReitDailyPrice {
  tradeDate: string
  close: number | null
  volume: number | null
}

export interface ReitLiquidityMonthRow {
  month: string
  tradingDays: number
  noTradeDays: number
  // 張（1 張＝1,000 個受益權單位），一位小數：一個月平均不到 10 張的月份有（01001T 2022 年最低 1.9 張）
  averageDailyLots: number
  averageDailyValue: number
}

export function reitLiquidityMonths(entries: ReitDailyPrice[]): ReitLiquidityMonthRow[] {
  const sorted = [...entries].sort((a, b) => a.tradeDate.localeCompare(b.tradeDate))
  return [...Map.groupBy(sorted, day => day.tradeDate.slice(0, 7))].map(([month, days]) => {
    const traded = days.flatMap(day => (day.close !== null && day.close > 0 ? [{ close: day.close, shares: day.volume ?? 0 }] : []))
    return {
      month,
      tradingDays: days.length,
      noTradeDays: days.length - traded.length,
      averageDailyLots: Math.round(traded.reduce((sum, day) => sum + day.shares, 0) / days.length / 100) / 10,
      averageDailyValue: Math.round(traded.reduce((sum, day) => sum + day.close * day.shares, 0) / days.length)
    }
  })
}
