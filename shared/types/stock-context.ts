// server/api/stock/[code]/context.get.ts — the "where does this company sit" data the
// /stock/:code index page renders server-side (2026-09-19, the SEO build): supply-chain peers
// with a side-by-side metric table, and the company's own market-wide rank on a few objective
// fields. Every source endpoint is per symbol on bff-ts and cached by server/utils/stock-data.ts.

// GET /stocks/:symbol/peer-group (analysis-ts, Gemini-parsed supply-chain classification).
export interface PeerGroupResponse {
  symbol: string
  companyName: string
  found: boolean
  notFoundReason: string | null
  peerGroupLevel: string | null
  peerGroupNodeId: string | null
  peerGroupLabel: string | null
  category: string | null
  coarseGroup: string | null
  source: string | null
  updatedAt: string | null
  // Includes the company itself.
  peers: { symbol: string; companyName: string }[]
}

// One cell of POST /screener/values (same shape as the screener's ScreenerFieldValue).
export interface ContextFieldValue {
  value: string | null
  knowledgeDate: string
  nullReason: string | null
}

export interface ContextValuesColumn {
  field: string
  metricName: string
  fieldName: string
  unit: string | null
}

export interface PeerValuesResponse {
  count: number
  columns: ContextValuesColumn[]
  results: { symbol: string; name: string; values: Record<string, ContextFieldValue | null> }[]
}

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
  peerGroup: PeerGroupResponse | null
  // The peer table's values for the company and its peers (self included), or null if that
  // one call failed.
  peerValues: PeerValuesResponse | null
  ranks: StockContextRank[]
}
