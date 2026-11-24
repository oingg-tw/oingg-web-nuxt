// 全市場的注意股票與處置股票（2026-11-24，使用者「做一頁」；數據中台 /market/attention-stocks、/market/disposed-stocks，業務中台轉發）。
// 兩支都是上市、上櫃各取最近 limit 筆、合併後新到舊再取 limit 筆（上限 50）；處置的依公告日排，處置期間結束的也在裡面。櫃買的處置列
// 沒有「第幾次處置」（null）
export interface AttentionStock {
  symbol: string
  companyName: string | null
  market: string
  tradeDate: string
  reason: string
  close: number | null
  sixDayChangePct: number | null
}

export interface DisposedStock {
  symbol: string
  companyName: string | null
  market: string
  announcementDate: string
  reason: string | null
  dispositionStartDate: string
  dispositionEndDate: string
  dispositionMeasures: string | null
}

export const MARKET_LIST_LIMIT = 50

// 處置期間還沒結束的（結束日 ≥ 今天）：處置中的在前、將處置的在後，各自照開始日
export function liveDispositions(items: DisposedStock[], today: string): (DisposedStock & { upcoming: boolean })[] {
  return items
    .filter(item => item.dispositionEndDate >= today)
    .map(item => ({ ...item, upcoming: item.dispositionStartDate > today }))
    .sort((a, b) => Number(a.upcoming) - Number(b.upcoming) || a.dispositionStartDate.localeCompare(b.dispositionStartDate) || a.symbol.localeCompare(b.symbol))
}

export function dispositionAnswer(live: { upcoming: boolean }[]): string {
  const upcoming = live.filter(item => item.upcoming).length
  const active = live.length - upcoming
  if (!live.length) return '目前沒有處置中的股票。'
  return `目前有 ${active} 檔處置中${upcoming ? `、${upcoming} 檔即將處置` : ''}。`
}

// 注意股票：最近一天列了幾檔。最近那一天剛好占滿 50 筆時，那一天可能還有沒列到的，只能說「至少」
export function attentionAnswer(items: AttentionStock[]): string {
  const latest = items[0]?.tradeDate
  if (!latest) return '最近沒有注意股票。'
  const count = items.filter(item => item.tradeDate === latest).length
  return `${latest} ${count >= MARKET_LIST_LIMIT ? '至少' : ''}有 ${count} 檔被列為注意股票。`
}
