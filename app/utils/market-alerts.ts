// 全市場的注意股票與處置股票（2026-11-24，使用者「做一頁」；數據中台 /market/attention-stocks、/market/disposed-stocks，業務中台轉發）。
// 處置的依公告日排，處置期間結束的也在裡面。櫃買的處置列沒有「第幾次處置」（null）
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

// 上市、上櫃分開讀，各最近 50 筆（market 參數，2026-11-24 數據中台）：不帶的話兩所合併後又截回 50 筆，同一天上市排前面，DEV 上 11-23 的
// 上櫃注意股票整批被截掉。每一份只留那一所的列：上游還沒認得 market 時兩份都是合併的清單，這樣合起來也不會重複。新到舊，同一天上市在前
export const ALERT_MARKETS = ['sii', 'otc'] as const
export interface MarketList<T> { market: string; items: T[] }
export function mergeMarkets<T extends { market: string }>(lists: MarketList<T>[], dateOf: (item: T) => string): T[] {
  return lists.flatMap(list => list.items.filter(item => item.market === list.market)).sort((a, b) => dateOf(b).localeCompare(dateOf(a)))
}

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

// 注意股票：最近一天列了幾檔。有一份讀滿 50 筆而且全是最近那一天時，那一天可能還有沒列到的，只能說「至少」
export function attentionAnswer(lists: MarketList<AttentionStock>[]): string {
  const items = mergeMarkets(lists, item => item.tradeDate)
  const latest = items[0]?.tradeDate
  if (!latest) return '最近沒有注意股票。'
  const count = items.filter(item => item.tradeDate === latest).length
  const cut = lists.some(list => list.items.length >= MARKET_LIST_LIMIT && list.items.every(item => item.tradeDate === latest))
  return `${latest} ${cut ? '至少' : ''}有 ${count} 檔被列為注意股票。`
}
