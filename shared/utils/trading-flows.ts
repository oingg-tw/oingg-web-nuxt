// 信用交易與三大法人（2026-11-24，數據中台 00185-jqq、業務中台轉發；使用者 11-23 選的「信用交易」「三大法人買賣超」）：上游給每天一列，
// 伺服器讀 10 年、併成每月一列給圖（全站的圖都讀 10 年、近 1～8 年），最近幾天原樣給表。被 scripts/check-trading-flows.mjs 直接
// import，所以零 import

// GET /stocks/{symbol}/margin-history：沒有那一天＝那天不在融資融券名單上；限額是 0 的日子是暫停，使用率是 null。
// latest 是 null＝目前不能信用交易。借券賣出餘額只有上櫃有（sblShortBalanceSource 'tpex'），上市在證交所網站、不在開放資料
export interface MarginDay {
  tradeDate: string
  marginBalanceLots: number | null
  marginLimitLots: number | null
  marginUtilizationRate: number | null
  shortBalanceLots: number | null
  shortToMarginRatio: number | null
  sblShortBalanceLots: number | null
  // 借券賣出上限（證交所 TWT96U，數據中台 dddb66f、業務中台 56a5d67）：那一天可以借券賣出的額度，上市、上櫃都有，2026-11-12 起，零股留小數
  sblShortAvailableLots: number | null
}

// 停資停券預告的一段（2026-11-28，數據中台 7710bf8：證交所的停資停券預告表、櫃買的暫停融券賣出預告表）。減資兩種都停時 margin、short 各一列、
// 起訖相同；同一段期間也可能因不同原因各一列。reason 是交易所寫的原樣，上櫃沒寫是 null。endDate null＝來源沒寫迄日
export interface MarginSuspension {
  suspensionType: string
  reason: string | null
  startDate: string
  endDate: string | null
  // 最後一次還在預告表上的那一份的日期
  lastSeenDate: string
}

// latest 的兩個旗標是實際狀態（交易所每天的融資融券資料）；suspensions 是預告，不是實際狀態：上櫃只預告停券、不寫原因，而且常漏
//（櫃買每天其實有 75～82 家停資）。suspensionsAsOf 是那一所最新一份預告表的日期。業務中台轉發之前、網站快取裡換版前存的那一份沒有這兩個鍵
export interface MarginHistory {
  symbol: string
  market: string | null
  latest: { tradeDate: string; isMarginSuspended: boolean | null; isShortSuspended: boolean | null } | null
  sblShortBalanceSource: string | null
  suspensions?: MarginSuspension[]
  suspensionsAsOf?: string | null
  entries: MarginDay[]
}

// 還沒結束的預告：有迄日的看迄日；沒寫迄日的要還在最新一份預告表上（lastSeenDate＝asOf），不然不知道它結束了沒（1516 的減資最後出現在
// 10-12，早就不在表上）。伺服器拿 asOf 當「今天」先篩一次（asOf 不會晚於今天，快取裡的不會因為過了一天變錯），頁面再用真的今天篩
export const liveSuspensions = (items: MarginSuspension[], asOf: string | null, today: string): MarginSuspension[] =>
  items.filter(item => (item.endDate ? item.endDate >= today : item.lastSeenDate === asOf))

// 每月一列是那個月最後一天的那一列（餘額看月底；這個月還沒過完就是最新一天），tradeDate 留著，答句寫得出是哪一天
export interface MarginMonth extends MarginDay {
  month: string
}

export function marginMonths(entries: MarginDay[]): MarginMonth[] {
  const sorted = [...entries].sort((a, b) => a.tradeDate.localeCompare(b.tradeDate))
  return [...Map.groupBy(sorted, day => day.tradeDate.slice(0, 7))].map(([month, days]) => ({ month, ...days.at(-1)! }))
}

// GET /stocks/{symbol}/institutional-trades：上櫃才有（source 'tpex'），上市回空陣列＋source null（證交所的個股三大法人只在網站上）。
// 單位是張，帶小數（零股）
export interface InstitutionalDay {
  tradeDate: string
  foreignNetBuyLots: number | null
  investmentTrustNetBuyLots: number | null
  dealerNetBuyLots: number | null
  totalNetBuyLots: number | null
}

export interface InstitutionalTrades {
  symbol: string
  market: string | null
  source: string | null
  entries: InstitutionalDay[]
}

// 每月一列是那個月每天的買賣超加總；某一類整個月都沒有值就是 null，不是 0
export interface InstitutionalMonth {
  month: string
  foreignNetBuyLots: number | null
  investmentTrustNetBuyLots: number | null
  dealerNetBuyLots: number | null
  totalNetBuyLots: number | null
}

const INSTITUTIONAL_KEYS = ['foreignNetBuyLots', 'investmentTrustNetBuyLots', 'dealerNetBuyLots', 'totalNetBuyLots'] as const

export function institutionalMonths(entries: InstitutionalDay[]): InstitutionalMonth[] {
  const sorted = [...entries].sort((a, b) => a.tradeDate.localeCompare(b.tradeDate))
  return [...Map.groupBy(sorted, day => day.tradeDate.slice(0, 7))].map(([month, days]) => {
    const sums = INSTITUTIONAL_KEYS.map((key) => {
      const values = days.flatMap(day => (day[key] === null ? [] : [day[key]]))
      // 張帶三位小數（股數 ÷ 1000），加總後四捨五入回三位，免得浮點雜訊
      return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) * 1000) / 1000 : null
    })
    return { month, foreignNetBuyLots: sums[0]!, investmentTrustNetBuyLots: sums[1]!, dealerNetBuyLots: sums[2]!, totalNetBuyLots: sums[3]! }
  })
}

// 網站自己的兩支（/api/stock/{code}/margin-trading、/institutional-trades）：每月給圖，最近 10 個交易日給表（新的在前）
export interface MarginTradingPage extends Pick<MarginHistory, 'market' | 'latest' | 'sblShortBalanceSource' | 'suspensions' | 'suspensionsAsOf'> {
  months: MarginMonth[]
  recent: MarginDay[]
}

export interface InstitutionalTradesPage extends Pick<InstitutionalTrades, 'market' | 'source'> {
  months: InstitutionalMonth[]
  recent: InstitutionalDay[]
}

export const RECENT_DAYS = 10
// 由舊到新排好，取最後幾天、新的在前
export const recentDays = <T extends { tradeDate: string }>(entries: T[]): T[] =>
  [...entries].sort((a, b) => a.tradeDate.localeCompare(b.tradeDate)).slice(-RECENT_DAYS).reverse()
