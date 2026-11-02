// 首頁「接下來的除權息與發放」（2026-11-02 首頁改版，使用者選了 B-3）：要讀哪幾個月的除權息、從今天起有事件的那幾天。被
// scripts/check-home-agenda.mjs 直接 import，所以零 import
interface DividendRow {
  symbol: string
  name: string
  exDate: string
  paymentDate: string | null
  cash: number | null
  exType: string
}

// 除權息日分月：這個月與下個月（接下來的除權息），再往前三個月——發放日在除權息日之後，接下來發放的錢可能是前幾個月除權息的。
// shortcut: 除權息後超過三個月才發放的會漏掉；要完整就請業務中台加一支依發放日區間查的
export function homeMonths(today: string): string[] {
  const start = new Date(`${today.slice(0, 7)}-01T00:00:00Z`)
  return [-3, -2, -1, 0, 1].map((offset) => {
    const month = new Date(start)
    month.setUTCMonth(month.getUTCMonth() + offset)
    return month.toISOString().slice(0, 7)
  })
}

// 從今天起、有事件的前 limit 天。同一天同一檔只算一次，照代號排
export function upcomingDays<Row extends DividendRow>(rows: Row[], today: string, field: 'exDate' | 'paymentDate', limit: number) {
  const byDate = new Map<string, Map<string, Row>>()
  for (const row of rows) {
    const date = row[field]
    if (!date || date < today) continue
    const day = byDate.get(date) ?? new Map<string, Row>()
    if (!day.has(row.symbol)) day.set(row.symbol, row)
    byDate.set(date, day)
  }
  return [...byDate.keys()].sort().slice(0, limit).map(date => ({
    date,
    items: [...byDate.get(date)!.values()]
      .sort((a, b) => a.symbol.localeCompare(b.symbol))
      .map(({ symbol, name, cash, exType }) => ({ symbol, name, cash, exType: exType as Row['exType'] }))
  }))
}
