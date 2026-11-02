// 首頁「這兩週的除權息與發放」（2026-11-02，首頁改版 B-1）：哪兩週、要讀哪幾個月的除權息、一天的摘要。被
// scripts/check-home-weeks.mjs 直接 import，所以零 import
interface DividendRow {
  symbol: string
  name: string
  exDate: string
  paymentDate: string | null
}

const DAY_MS = 86_400_000
const addDays = (date: string, days: number) => new Date(Date.parse(date) + days * DAY_MS).toISOString().slice(0, 10)

// 週一到週五兩週。週末看下一週（週六日不畫，跟配息月曆同一條規則），標題跟著改
export function homeWeeks(today: string): { label: string; dates: string[] }[] {
  const weekday = new Date(today).getUTCDay()
  const weekend = weekday === 0 || weekday === 6
  const monday = addDays(today, weekend ? (weekday === 6 ? 2 : 1) : 1 - weekday)
  const week = (offset: number) => [0, 1, 2, 3, 4].map(day => addDays(monday, offset + day))
  return weekend
    ? [{ label: '下週', dates: week(0) }, { label: '下下週', dates: week(7) }]
    : [{ label: '本週', dates: week(0) }, { label: '下週', dates: week(7) }]
}

// 要讀的月份（除權息日分月）：兩週碰到的月份，再往前三個月——發放日在除權息日之後，這兩週發放的錢可能是前幾個月除權息的。
// shortcut: 除權息後超過三個月才發放的會漏掉；要完整就請業務中台加一支依發放日區間查的
export function homeMonths(first: string, last: string): string[] {
  const months = new Set<string>()
  const start = new Date(`${first.slice(0, 7)}-01T00:00:00Z`)
  for (let back = 3; back >= 0; back--) {
    const month = new Date(start)
    month.setUTCMonth(month.getUTCMonth() - back)
    months.add(month.toISOString().slice(0, 7))
  }
  months.add(last.slice(0, 7))
  return [...months]
}

// 一天的除權息或發放：不重複代號數，前兩檔照代號排
export function dayEvents(rows: DividendRow[], date: string, field: 'exDate' | 'paymentDate') {
  const bySymbol = new Map(rows.filter(row => row[field] === date).map(row => [row.symbol, row.name]))
  const symbols = [...bySymbol.keys()].sort()
  return { count: symbols.length, first: symbols.slice(0, 2).map(symbol => ({ symbol, name: bySymbol.get(symbol)! })) }
}
