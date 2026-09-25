// Wire shape of bff-ts's GET /stocks/:symbol/dividend-history (proxy of analysis-ts's
// GET /companies/dividend-history, both shipped 2026-09-19 on this app's request). One entry per
// 股利所屬年度, oldest first; a quarterly payer's four resolutions in one fiscal year are summed
// into that year's row, with the per-resolution dates kept in `events`.
//
// analysis-ts's own stated semantics (2026-09-19):
// - exDividendDate = 現金股利的除息日, exRightsDate = 股票股利的除權日 — the year row carries the
//   year's LAST one of each; per-event dates are in `events`.
// - payoutRatio = 該年度現金股利 ÷ 該年度 EPS（eps.Q 四季加總）×100; null when the four quarters
//   aren't all available or EPS ≤ 0 — so 2330 has it from 2021 on, null for 2018–2020.
// - yieldAtExDate = the sum over that year's events of 現金股利 ÷ 除息日當天收盤價（已除息）; null
//   for the whole year when any event's price is missing. Most companies only have prices from
//   2026-06 on (twse-ts's range), so historical rows are mostly null — not missing data.
// - knowledgeDate = the year's last resolution's announcement date.
// - Depth: 民國 107 年 (2018) onward today; mops-ts backfills earlier years from 2026-09-24.

export interface DividendHistoryEvent {
  fiscalQuarter: number | null
  cashDividend: number | null
  stockDividend: number | null
  exDividendDate: string | null
  exRightsDate: string | null
  paymentDate: string | null
  announcementDate: string | null
  closeAtExDate: number | null
  yieldAtExDate: number | null
}

export interface DividendHistoryEntry {
  fiscalYear: number
  rocFiscalYear: number
  cashDividend: number | null
  stockDividend: number | null
  totalDividend: number | null
  distributionCount: number
  exDividendDate: string | null
  exRightsDate: string | null
  paymentDate: string | null
  eps: number | null
  // 盈餘分配 ÷ 年報 EPS（2026-09-25 上游改定義，分子從「現金股利合計」換成「盈餘分配的那一塊」）。
  // 全部來自公積時是 0 不是 null；eps ≤ 0 或缺年報時是 null。注意這跟指標型錄的
  // `dividendPayoutRatio` 分子不同——那一支取自現金流量表的股利發放，含公積且無法拆開，所以有公積
  // 發放的公司兩者不會相等，不要互相驗證。
  payoutRatio: number | null
  // 現金股利的兩個來源。上游契約說一定是數字，但 bff-ts 在改名空窗期實測到整批消失，所以型別放寬：
  //   0     上游說這個成分確實沒有
  //   null  上游沒送這個欄位
  // 不要假設是數字。也不要拿兩者相加去驗證 cashDividend——各自四捨五入，合計才是權威值。
  cashDividendFromEarnings: number | null
  // 法定盈餘公積「加」資本公積，合在一欄拆不開。所以這一塊不能整體說成「退還股本」：資本公積才是
  // 退還股東繳進來的錢，法定盈餘公積是以前年度盈餘提存的，那是保留獲利。文案只能說「來自公積」。
  cashDividendFromLegalReserveAndCapitalSurplus: number | null
  yieldAtExDate: number | null
  knowledgeDate: string | null
  events: DividendHistoryEvent[]
}

export interface DividendHistoryResponse {
  symbol: string
  entries: DividendHistoryEntry[]
}

// 填息 — one row per cash-dividend event, computed on the SERVER from the daily close series
// （2026-09-24,「我也需要有個地方解釋為什麼填權填息很重要」）.
//
// WHY THIS BELONGS ON THE 現金殖利率 PAGE rather than being a separate metric: a dividend does not
// create wealth at the moment it is paid — the reference price drops by exactly the cash paid, so
// 「唯有後續…推動股價回升至除權息前價位（完成「填息」），投資人方能實現真實經濟增量收益。這是理解
// 「高殖利率不等於高報酬」的數學基礎」. The yield number on this page means nothing without it.
//
// WHAT IS COMPARED: the close on the last trading day BEFORE the ex-date. Not `closeAtExDate` —
// that is the close ON the ex-date, already ex-dividend, so comparing against it would report a
// fill that never happened.
export interface DividendFillEvent {
  exDividendDate: string
  cashDividend: number
  // 除息前一交易日的收盤價 — the level the close has to reach again.
  preExClose: number | null
  // The first trading day on or after the ex-date whose close reached `preExClose`; null when it
  // has not happened yet, or when `unavailableReason` says it cannot be computed.
  filledDate: string | null
  // TRADING days from the ex-date to `filledDate`, not calendar days — the ex-date is 0.
  tradingDays: number | null
  // Distinguishes「still below」from「cannot be computed」, which a blank cell cannot. The page
  // prints the reason rather than an empty cell.
  //   'before-price-history' — the ex-date predates the daily series we can read（~6 years）
  //   'stock-dividend'       — the event also paid 股票股利, so the reference price adjusts for the
  //                            share ratio too and a bare price comparison would be wrong
  unavailableReason: 'before-price-history' | 'stock-dividend' | null
}
