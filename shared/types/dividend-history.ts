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
  payoutRatio: number | null
  yieldAtExDate: number | null
  knowledgeDate: string | null
  events: DividendHistoryEvent[]
}

export interface DividendHistoryResponse {
  symbol: string
  entries: DividendHistoryEntry[]
}
