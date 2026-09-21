// Market-wide company ranks (GET /screener/company-rank), cached per symbol by
// server/utils/stock-data.ts's cachedCompanyRank.
//
// Named for server/api/stock/[code]/context.get.ts, which no longer exists: that route carried a
// supply-chain peer table until 2026-09-20 (analysis-ts hard-deleted GET /companies/peer-group,
// commit a7489d65) and four rank sentences until later the same day, when the /stock/:code index
// page's「在全市場排第幾？」section was removed on direct instruction — leaving it with no
// consumer at all. `StockContextResponse`, its envelope, went with it.
//
// What remains is used through a different path entirely: StockSeriesResponse.ranks
// (shared/types/stock-series.ts), which the 配股配息 page reads for its 殖利率 rank. The file
// keeps its name so those imports don't churn.

// GET /screener/company-rank?symbol&field&direction&excludeZero — rank among every company that
// has the field; `topPercent` is the position from the top of that ordering. `excludeZero`
// (analysis-ts, 2026-09-20) drops companies whose value is exactly 0 from the ranked population —
// used for dividendYield.EOD so a company IS ranked against payers only, not diluted by the ~16%
// of the market that pays no dividend at all. `quintile` (1–5, low→high by value, independent of
// `direction`) arrived the same day; not surfaced in any answer sentence yet — see
// server/utils/stock-data.ts's own comment on why.
export interface CompanyRankResponse {
  symbol: string
  field: string
  found: boolean
  value: number | null
  rank: number | null
  totalCount: number | null
  topPercent: number | null
  quintile: number | null
}

export interface StockContextRank {
  field: string
  direction: 'asc' | 'desc'
  rank: CompanyRankResponse | null
}
