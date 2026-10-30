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
