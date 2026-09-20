// server/api/stock/[code]/context.get.ts — the company's own market-wide rank on a few
// objective fields, for the /stock/:code index page (2026-09-19, the SEO build). Every source
// endpoint is per symbol on bff-ts and cached by server/utils/stock-data.ts.
//
// This used to also carry a supply-chain peer table (`peerGroup`/`peerValues`, GET
// /companies/peer-group + POST /screener/values) — removed 2026-09-20 when analysis-ts hard-
// deleted GET /companies/peer-group with no replacement (commit a7489d65, a compliance call on
// the underlying oingg-playwright-py classification, not a temporary outage).

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

export interface StockContextResponse {
  symbol: string
  ranks: StockContextRank[]
}
