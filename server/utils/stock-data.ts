import type { MetricsHistoryEntry, MetricsHistorySeries, MetricsHistoryTimeframe } from '#shared/types/metrics-history'
import type { StockBadges } from '#shared/types/stock-badges'
import type { PiotroskiBreakdown } from '#shared/types/piotroski'
import type { FinancialStatementResponse, StatementType } from '#shared/types/financial-statement'
import type { DividendHistoryResponse } from '#shared/types/dividend-history'
import type { CompanyRankResponse, PeerGroupResponse, PeerValuesResponse } from '#shared/types/stock-context'
import type { StockSeriesPage, StockSeriesResponse } from '#shared/types/stock-series'

// Per-symbol bff-ts data behind the /stock/:code pages, each wrapped in Nitro's
// defineCachedFunction (2026-09-19, the SEO build). Why a server cache layer instead of the
// browser-side composables fetching bff-ts directly: a crawler renders every one of ~2,650
// symbols × 6 pages cold, and each render used to fan out 7–13 uncached upstream calls — about
// 25 pages a minute already exhausted bff-ts's 300 req/60s limit, and the render that hit the
// limit got indexed as the thin version. With these, a warm page costs the upstream 0–3 calls.
//
// Rules shared by every function here:
// - bffFetch throws on failure → nothing is cached for that key; an existing stale entry is
//   served (swr) while the refresh fails in the background, so a bff-ts outage degrades to stale
//   pages rather than empty ones.
// - `name` is set explicitly on each（Nitro's default key would collide across anonymous
//   functions）; bump a name（-v2）when a function's return shape changes, since a dev cache
//   entry outlives the code that wrote it until its maxAge passes.
// - TTLs: fundamentals change once a quarter（6–12h is plenty）; profile/peer data once a day;
//   nothing here is a live quote — the summary card's daily price is still fetched by the page.

const TTL_FUNDAMENTALS = 6 * HOUR
const TTL_STATEMENTS = 12 * HOUR
const TTL_STATIC = 24 * HOUR

interface MetricsHistoryResponse {
  total: number
  entries: MetricsHistoryEntry[]
}

export const cachedMetricsHistory = defineCachedFunction(
  async (symbol: string, timeframe: MetricsHistoryTimeframe, codes: string[], limit: number): Promise<MetricsHistorySeries> => {
    const response = await bffFetch<MetricsHistoryResponse>(`/stocks/${symbol}/metrics-history`, {
      // Wire query key stays `basis` — bff-ts's own external contract (see useMetricsHistory.ts).
      query: { metricCodes: codes.join(','), basis: timeframe, limit }
    })
    return { timeframe, codes, limit, entries: response.entries, total: response.total }
  },
  {
    name: 'stock-metrics-history',
    getKey: (symbol, timeframe, codes, limit) => `${symbol}:${timeframe}:${limit}:${codes.join(',')}`,
    maxAge: TTL_FUNDAMENTALS,
    staleMaxAge: TTL_STATIC,
    swr: true
  }
)

export const cachedBadges = defineCachedFunction(
  (symbol: string) => bffFetch<StockBadges>(`/stocks/${symbol}/badges`),
  { name: 'stock-badges', getKey: symbol => symbol, maxAge: TTL_FUNDAMENTALS, staleMaxAge: TTL_STATIC, swr: true }
)

export const cachedPiotroskiBreakdown = defineCachedFunction(
  (symbol: string) => bffFetch<PiotroskiBreakdown>(`/stocks/${symbol}/piotroski-breakdown`),
  { name: 'stock-piotroski-breakdown', getKey: symbol => symbol, maxAge: TTL_FUNDAMENTALS, staleMaxAge: TTL_STATIC, swr: true }
)

export const cachedDividendHistory = defineCachedFunction(
  (symbol: string) => bffFetch<DividendHistoryResponse>(`/stocks/${symbol}/dividend-history`),
  { name: 'stock-dividend-history', getKey: symbol => symbol, maxAge: TTL_STATEMENTS, staleMaxAge: TTL_STATIC, swr: true }
)

export const cachedPeerGroup = defineCachedFunction(
  (symbol: string) => bffFetch<PeerGroupResponse>(`/stocks/${symbol}/peer-group`),
  { name: 'stock-peer-group', getKey: symbol => symbol, maxAge: TTL_STATIC, staleMaxAge: TTL_STATIC, swr: true }
)

// POST /screener/values — `columns` must be objects（{ field }）, a plain string array 400s.
export const cachedPeerValues = defineCachedFunction(
  (symbols: string[], fields: string[]) =>
    bffFetch<PeerValuesResponse>('/screener/values', {
      method: 'POST',
      body: { symbols, columns: fields.map(field => ({ field })) }
    }),
  // `:` between the two lists, not `|` — keys become file names in the dev cache（Windows rejects `|`）.
  { name: 'stock-peer-values', getKey: (symbols, fields) => `${symbols.join(',')}:${fields.join(',')}`, maxAge: TTL_FUNDAMENTALS, staleMaxAge: TTL_STATIC, swr: true }
)

// GET /screener/company-rank — `direction` is required by bff-ts (asc|desc).
export const cachedCompanyRank = defineCachedFunction(
  (symbol: string, field: string, direction: 'asc' | 'desc') =>
    bffFetch<CompanyRankResponse>('/screener/company-rank', { query: { symbol, field, direction } }),
  { name: 'stock-company-rank', getKey: (symbol, field, direction) => `${symbol}:${field}:${direction}`, maxAge: TTL_FUNDAMENTALS, staleMaxAge: TTL_STATIC, swr: true }
)

// GET /stocks/:symbol/financial-statement — 民國年 on the wire; null year/season = the latest
// filing bff-ts has（its own contract, verified 2026-09-19: no year/season → year "115" season "2"）.
export const cachedFinancialStatement = defineCachedFunction(
  (symbol: string, statementType: StatementType, rocYear: number | null, season: number | null) =>
    bffFetch<FinancialStatementResponse>(`/stocks/${symbol}/financial-statement`, {
      query: rocYear && season ? { statementType, year: rocYear, season } : { statementType }
    }),
  {
    name: 'stock-financial-statement',
    getKey: (symbol, statementType, rocYear, season) => `${symbol}:${statementType}:${rocYear ?? 'latest'}:${season ?? 'latest'}`,
    maxAge: TTL_STATEMENTS,
    staleMaxAge: TTL_STATIC,
    swr: true
  }
)

// ---- Page plans for /api/stock/:code/series ------------------------------------------------
//
// Every group is timeframe-pure（bff-ts 400s a whole request if one code doesn't support the
// basis）and ≤ 10 codes（bff-ts's cap）; each code's allowed timeframes were checked against
// GET /metrics' own field keys on 2026-09-19. Group names are stable identifiers the digest
// composable reads by name（useStockPageDigest.ts）— rename with care.
//
// The `_1` groups are the digest's "latest period" facts（same code sets the 2026-09-19 digest
// already used, so the meta descriptions don't change wording）; the `_20`/`_40` groups feed the
// pages' visible tables AND pre-warm the card composables' caches — a card whose own request is a
// subset of one of these（same symbol/timeframe, codes ⊆, limit ≤）renders in SSR without a call
// of its own（useMetricsHistory.ts's superset hit）.

interface SeriesGroupPlan {
  timeframe: MetricsHistoryTimeframe
  codes: string[]
  limit: number
}

const SERIES_GROUPS = {
  TTM_CORE_1: { timeframe: 'TTM', codes: ['eps', 'roe', 'roa', 'grossMargin', 'operatingMargin', 'netProfitMargin', 'ocfPerShare', 'fcfPerShare', 'dividendPerShare', 'dividendPayoutRatio'], limit: 1 },
  Q_CORE_1: { timeframe: 'Q', codes: ['debtRatio', 'currentRatio', 'quickRatio', 'piotroskiFScore', 'revenueGrowthRate', 'epsGrowthRate', 'netIncomeGrowthRate', 'pbRatio', 'bvps', 'shareCountChangeRate'], limit: 1 },
  FY_CORE_1: { timeframe: 'FY', codes: ['consecutiveDividendYears', 'dividendGrowthRate5y', 'epsCagr5y', 'revenueCagr5y', 'consecutiveProfitYears', 'chowderNumber'], limit: 1 },
  TTM_PER_SHARE_1: { timeframe: 'TTM', codes: ['revenuePerShare', 'eps', 'ocfPerShare', 'fcfPerShare', 'dividendPerShare'], limit: 1 },
  Q_BVPS_1: { timeframe: 'Q', codes: ['bvps'], limit: 1 },
  // The stock's own PE/PB quarterly history for the digest's percentile sentences.
  PE_TTM_20: { timeframe: 'TTM', codes: ['peRatio'], limit: 20 },
  PB_Q_20: { timeframe: 'Q', codes: ['pbRatio'], limit: 20 },
  // 公司健檢 — one 20-quarter 單季 table per section, 5 calls for 41 codes.
  Q_A_20: { timeframe: 'Q', codes: ['eps', 'roe', 'roa', 'grossMargin', 'operatingMargin', 'netProfitMargin', 'revenueGrowthRate', 'epsGrowthRate', 'netIncomeGrowthRate', 'pbRatio'], limit: 20 },
  Q_B_20: { timeframe: 'Q', codes: ['debtRatio', 'currentRatio', 'quickRatio', 'cashRatio', 'interestCoverage', 'piotroskiFScore', 'accrualsRatio', 'ocfToNetIncome', 'bvps', 'stockPrice'], limit: 20 },
  Q_C_20: { timeframe: 'Q', codes: ['inventoryTurnover', 'receivablesTurnover', 'payablesTurnover', 'capexToRevenue', 'sue'], limit: 20 },
  TTM_A_20: { timeframe: 'TTM', codes: ['peRatio', 'altmanZScore', 'netDebtToEbitda', 'dividendCoverageRatio', 'buybackYield', 'shareholderYield', 'ocfPerShare', 'fcfPerShare', 'cashConversionCycle', 'dividendPerShare'], limit: 20 },
  // 配股配息 — the 配息數列 table（all available quarters）; StockDividendCashChainCard's four
  // codes are a subset, so that card renders in SSR from this group.
  TTM_DIV_40: { timeframe: 'TTM', codes: ['dividendPerShare', 'dividendPayoutRatio', 'dividendCoverageRatio', 'shareholderYield', 'buybackYield', 'fcfPerShare', 'ocfPerShare', 'eps'], limit: 40 },
  // 指標歷史 — the curated 逐年 table.
  TTM_CORE_40: { timeframe: 'TTM', codes: ['eps', 'roe', 'roa', 'grossMargin', 'operatingMargin', 'netProfitMargin', 'ocfPerShare', 'fcfPerShare', 'dividendPerShare', 'dividendPayoutRatio'], limit: 40 },
  TTM_EXTRA_40: { timeframe: 'TTM', codes: ['revenuePerShare', 'peRatio'], limit: 40 },
  Q_4_40: { timeframe: 'Q', codes: ['debtRatio', 'currentRatio', 'pbRatio', 'bvps'], limit: 40 },
  // /f-score — the score history table.
  FSCORE_Q_20: { timeframe: 'Q', codes: ['piotroskiFScore'], limit: 20 }
} satisfies Record<string, SeriesGroupPlan>

export type SeriesGroupName = keyof typeof SERIES_GROUPS

interface SeriesPagePlan {
  groups: SeriesGroupName[]
  badges?: boolean
  breakdown?: boolean
  dividendHistory?: boolean
  ranks?: { field: string; direction: 'asc' | 'desc' }[]
}

// Order matters: the digest keeps the FIRST group that carries a code, so the TTM "latest"
// groups come before the 單季 tables' groups on pages that have both（近四季 EPS in the lead
// sentence, 單季 EPS in the table）.
const SERIES_PLANS: Record<StockSeriesPage, SeriesPagePlan> = {
  // FY_CORE_1 feeds the index page's FAQ（連續配息年數）.
  index: { groups: ['TTM_CORE_1', 'FY_CORE_1', 'PE_TTM_20', 'PB_Q_20'], badges: true },
  // The annual（FY）figures are quoted in the 股東回饋 answer only, so the latest year is enough.
  'company-health': { groups: ['TTM_CORE_1', 'TTM_A_20', 'Q_A_20', 'Q_B_20', 'Q_C_20', 'FY_CORE_1'] },
  // The 殖利率 market rank replaces the old two-POST percentile bracketing card's own fetch.
  dividend: { groups: ['TTM_DIV_40', 'FY_CORE_1'], dividendHistory: true, ranks: [{ field: 'dividendYield.EOD', direction: 'desc' }] },
  'metrics-history': { groups: ['TTM_CORE_40', 'Q_CORE_1', 'TTM_EXTRA_40', 'Q_4_40'] },
  'financial-statements': { groups: ['TTM_PER_SHARE_1', 'Q_BVPS_1'] },
  'f-score': { groups: ['FSCORE_Q_20'], badges: true, breakdown: true }
}

export function isStockSeriesPage(value: string): value is StockSeriesPage {
  return Object.prototype.hasOwnProperty.call(SERIES_PLANS, value)
}

async function settle<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise
  } catch {
    return null
  }
}

export async function runStockSeriesPlan(symbol: string, page: StockSeriesPage): Promise<StockSeriesResponse> {
  const plan = SERIES_PLANS[page]
  const [groupResults, badges, breakdown, dividendHistory, ranks] = await Promise.all([
    Promise.all(
      plan.groups.map(async name => {
        const group = SERIES_GROUPS[name]
        return [name, await settle(cachedMetricsHistory(symbol, group.timeframe, group.codes, group.limit))] as const
      })
    ),
    plan.badges ? settle(cachedBadges(symbol)) : Promise.resolve(undefined),
    plan.breakdown ? settle(cachedPiotroskiBreakdown(symbol)) : Promise.resolve(undefined),
    plan.dividendHistory ? settle(cachedDividendHistory(symbol)) : Promise.resolve(undefined),
    plan.ranks
      ? Promise.all(plan.ranks.map(async ({ field, direction }) => ({ field, direction, rank: await settle(cachedCompanyRank(symbol, field, direction)) })))
      : Promise.resolve(undefined)
  ])
  const groups: StockSeriesResponse['groups'] = {}
  for (const [name, series] of groupResults) groups[name] = series
  const response: StockSeriesResponse = { symbol, page, groups }
  if (badges !== undefined) response.badges = badges
  if (breakdown !== undefined) response.breakdown = breakdown
  if (dividendHistory !== undefined) response.dividendHistory = dividendHistory
  if (ranks !== undefined) response.ranks = ranks
  return response
}
