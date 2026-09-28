import type { MetricsHistoryEntry, MetricsHistorySeries, MetricsHistoryTimeframe } from '#shared/types/metrics-history'
import type { StockBadges } from '#shared/types/stock-badges'
import type { FinancialStatementResponse, StatementType } from '#shared/types/financial-statement'
import type { StockBookValueBreakdownResponse } from '#shared/types/stock-equity-composition'
import type { DividendFillEvent, DividendHistoryResponse } from '#shared/types/dividend-history'
import type { CompanyRankResponse, PayerPercentile } from '#shared/types/stock-context'
import type { StockSeriesPage, StockSeriesResponse } from '#shared/types/stock-series'
import type { MetricProvenanceResponse } from '#shared/types/metric-provenance'

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

export const cachedDividendHistory = defineCachedFunction(
  (symbol: string) => bffFetch<DividendHistoryResponse>(`/stocks/${symbol}/dividend-history`),
  { name: 'stock-dividend-history', getKey: symbol => symbol, maxAge: TTL_STATEMENTS, staleMaxAge: TTL_STATIC, swr: true }
)

// GET /stocks/:symbol/daily-price-history — raw daily closes, ascending.
//
// Lives here rather than beside its caller because a second page now needs the same read: the
// 月營收 route has its own `cachedMonthlyPrices`, but that one caches the REDUCED monthly means it
// needs（60 points）, which is a different shape and a different cache entry. This one keeps the
// raw series, which is what 填息 has to walk day by day.
//
// 2000 rows is the endpoint's own cap and reaches back about six years（measured 2026-09-24:
// 2330 returned 1,433 rows starting 2020-11-02）. Dividend history goes back further（2018）, so
// the earliest ex-dates have no price to compare against — computeDividendFills says so per row
// rather than leaving a blank.
const DAILY_PRICE_ROWS = 2000

interface DailyClose {
  tradeDate: string
  close: number
}

// 無成交日的收盤價是 0，不是當天真的跌到零（2026-09-27，bff-ts 抽查 51 檔有 4 檔出現，1538 最近
// 六個交易日有五天是 0）。上游的 quote（GET /stocks/:symbol）已經會跳過這種日子，但
// daily-price-history 還沒一起修。
//
// 兩個消費者都會被它毀掉，而且第二個比第一個嚴重：
//   * 月營收頁的月均價 → 平均被 0 拉低
//   * 填息判斷 → computeDividendFills 逐日走這個序列，一天 0 會讓它斷定「除息後股價從沒回到原點」
//
// 所以濾在取值的地方，不是濾在畫圖的地方：畫圖只是其中一個消費者，而錯誤的填息結論會被寫成文字。
// 上游若之後改成跳過或回 null，這個守衛仍然成立（兩種都擋），不需要跟著改。
export const isRealClose = (entry: { close: number | null | undefined }): boolean =>
  typeof entry.close === 'number' && Number.isFinite(entry.close) && entry.close > 0

export const cachedDailyCloses = defineCachedFunction(
  async (symbol: string): Promise<DailyClose[]> => {
    const response = await bffFetch<{ entries: DailyClose[] }>(`/stocks/${symbol}/daily-price-history`, { query: { limit: DAILY_PRICE_ROWS } })
    return [...(response.entries ?? [])].filter(isRealClose).sort((a, b) => a.tradeDate.localeCompare(b.tradeDate))
  },
  { name: 'stock-daily-closes', getKey: symbol => symbol, maxAge: TTL_FUNDAMENTALS, staleMaxAge: TTL_STATIC, swr: true }
)

// 殖利率在「有配息公司」裡的百分位, derived from the rank this page already fetches（2026-09-24）.
//
// This was a pair of POST /screener counts for a few hours today, because GET /screener/company-rank
// silently dropped its `excludeZero` query parameter — bff-ts's own zod schema had no such field,
// so the flag never reached analysis-ts, which had supported it all along. The result was two
// contradicting percentiles on one screen: the answer sentence read company-rank's undiluted
// 1,723-company population（PR27）while the gauge counted its own 1,445（PR13）, and the sentence
// called the first one「有配息公司中」.
//
// bff-ts shipped the fix the same day（d02bc1b）: excludeZero=true now returns totalCount 1445 with
// the rank unchanged at 1259 — correct, since the 278 excluded companies all yield 0 and already
// sorted below this one. So the counts are gone and this derives from `ranks`, which the dividend
// plan fetches regardless. Two network calls and forty lines removed, same numbers.
function payerPercentileFrom(rank: CompanyRankResponse | null | undefined): PayerPercentile | null {
  if (!rank?.found || rank.value === null || rank.rank === null || !rank.totalCount) return null
  // Inclusive of the company itself, which is what a percentile-at-or-below means: the top-ranked
  // company is at 100, not at (total-1)/total.
  const atOrBelow = rank.totalCount - rank.rank + 1
  return { value: rank.value, total: rank.totalCount, atOrBelow, percentile: (atOrBelow / rank.totalCount) * 100 }
}

// 填息 per cash-dividend event — see DividendFillEvent for what is compared and why.
//
// Two cases it refuses to compute rather than guessing, both surfaced to the reader as a stated
// reason instead of an empty cell:
//
//   * an event that ALSO paid 股票股利: the reference price adjusts for the share ratio as well,
//     so comparing the plain close against the pre-ex close would report a fill that the holder
//     never got. 2330 never does this, but plenty of companies do.
//   * an ex-date before the daily series starts.
//
// Trading days, not calendar days: 「30 天」on a calendar spans a different number of sessions
// depending on where the new year falls, and the reader is counting sessions whether they say so
// or not. The ex-date itself is day 0.
export function computeDividendFills(history: DividendHistoryResponse | null, daily: DailyClose[]): DividendFillEvent[] {
  if (!history?.entries?.length || !daily.length) return []
  const firstDate = daily[0]!.tradeDate

  const fills: DividendFillEvent[] = []
  for (const entry of history.entries) {
    for (const event of entry.events ?? []) {
      const exDate = event.exDividendDate
      const cash = event.cashDividend
      if (!exDate || cash === null || cash <= 0) continue

      const base: DividendFillEvent = {
        exDividendDate: exDate,
        cashDividend: cash,
        preExClose: null,
        filledDate: null,
        tradingDays: null,
        unavailableReason: null
      }

      if (event.stockDividend !== null && event.stockDividend > 0) {
        fills.push({ ...base, unavailableReason: 'stock-dividend' })
        continue
      }
      if (exDate < firstDate) {
        fills.push({ ...base, unavailableReason: 'before-price-history' })
        continue
      }

      // First session on or after the ex-date. `findIndex` rather than an exact match: a symbol
      // suspended on its own ex-date would otherwise drop out of the table entirely.
      const exIndex = daily.findIndex(row => row.tradeDate >= exDate)
      if (exIndex <= 0) {
        fills.push({ ...base, unavailableReason: 'before-price-history' })
        continue
      }
      const preExClose = daily[exIndex - 1]!.close

      let filledDate: string | null = null
      let tradingDays: number | null = null
      for (let i = exIndex; i < daily.length; i += 1) {
        if (daily[i]!.close >= preExClose) {
          filledDate = daily[i]!.tradeDate
          tradingDays = i - exIndex
          break
        }
      }
      fills.push({ ...base, preExClose, filledDate, tradingDays })
    }
  }
  // Newest first, the same order the 歷年股利 table already uses.
  return fills.sort((a, b) => b.exDividendDate.localeCompare(a.exDividendDate))
}

// GET /stocks/:symbol/metric-provenance — the badge pages' calculation-audit table
// (app/pages/stock/[code]/[slug].vue, 2026-09-20). Confirmed live: /stocks/2330/metric-
// provenance?metricCode=roe returns real statement-field entries.
export const cachedMetricProvenance = defineCachedFunction(
  (symbol: string, metricCode: string) => bffFetch<MetricProvenanceResponse>(`/stocks/${symbol}/metric-provenance`, { query: { metricCode } }),
  { name: 'stock-metric-provenance', getKey: (symbol, metricCode) => `${symbol}:${metricCode}`, maxAge: TTL_FUNDAMENTALS, staleMaxAge: TTL_STATIC, swr: true }
)

// cachedPeerGroup / cachedPeerValues (GET /stocks/:symbol/peer-group, POST /screener/values for
// the peer table) removed 2026-09-20 — analysis-ts hard-deleted GET /companies/peer-group with
// no replacement (commit a7489d65); see shared/types/stock-context.ts's own header comment.

// GET /screener/company-rank — `direction` is required by bff-ts (asc|desc). `excludeZero`
// (analysis-ts, 2026-09-20) drops companies whose value is exactly 0 from the ranked population —
// see CompanyRankResponse's own comment. Omitted from the query (not sent as `excludeZero=false`)
// when unset, matching bff-ts's own GET /screener/distribution convention elsewhere in this file.
export const cachedCompanyRank = defineCachedFunction(
  (symbol: string, field: string, direction: 'asc' | 'desc', excludeZero?: boolean) =>
    bffFetch<CompanyRankResponse>('/screener/company-rank', { query: { symbol, field, direction, excludeZero: excludeZero || undefined } }),
  { name: 'stock-company-rank', getKey: (symbol, field, direction, excludeZero) => `${symbol}:${field}:${direction}:${excludeZero ?? false}`, maxAge: TTL_FUNDAMENTALS, staleMaxAge: TTL_STATIC, swr: true }
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

// GET /stocks/:symbol/book-value-breakdown — 每股淨值的逐年變動拆解（bff-ts 2026-09-27 上線）。
// 查無權益變動表回 entries: []（200，不是 404），所以呼叫端不需要處理 404。
export const cachedBookValueBreakdown = defineCachedFunction(
  (symbol: string) => bffFetch<StockBookValueBreakdownResponse>(`/stocks/${symbol}/book-value-breakdown`),
  { name: 'stock-book-value-breakdown', getKey: symbol => symbol, maxAge: TTL_STATEMENTS, staleMaxAge: TTL_STATIC, swr: true }
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
  // 營業費用的組成（2026-09-24, analysis-ts's 12 new per-share lines）. Its own group rather than
  // extra codes on TTM_CORE_1/TTM_PER_SHARE_1, because those two are shared by index/
  // company-health/financial-statements and widening them would change every one of those digests
  // for one page's benefit.
  //
  // otherOperatingIncomeExpensePerShare is the reason this group exists at all, not an extra:
  // 營業利益 = 毛利 − 營業費用 + 其他營業收益費損淨額, so deriving 營業費用 as 毛利率 − 營業利益率
  // silently folds that last term in. 2330 2026Q2 — filed 營業費用 14.23, 其他營業收益 0.31, derived
  // 13.92 — was shipped for a few hours with the derived figure under the label「營業費用」.
  // Coverage of the 其他 line is ~5%, which is exactly why it went unnoticed on 2317/1101/1216.
  TTM_OPEX_1: { timeframe: 'TTM', codes: ['operatingExpensePerShare', 'otherOperatingIncomeExpensePerShare', 'researchAndDevelopmentExpensePerShare', 'operatingIncomePerShare', 'nonOperatingIncomePerShare', 'incomeTaxExpensePerShare', 'minorityInterestPerShare'], limit: 1 },
  // 配息從哪來整頁改成年度（2026-09-25，使用者定案「整頁改成年度」）。損益表那條鏈的 15 支每股金額
  // 在同一天全部拿得到 FY 了，所以瀑布圖不必再用三率去推導金額——直接讀申報值，而且鏈的最後一格就是
  // 年報公告的 EPS。股利那一格從 dividend-history 讀，它的 fiscalYear 是盈餘所屬年度，跟這裡的
  // 會計年度是同一年，所以整條鏈第一次落在同一段盈餘上。
  //
  // 拆兩組是因為 metricCodes 上限是 10（實測送 12 個回 400）。limit 5 而不是 1：最新年度不一定完整
  // ——773 家的 114 年報還沒匯入，抽樣 20 檔有 14 檔最新只到 113 年度——所以要往回找第一個「每個科目
  // 都有值」的年度，不能只拿最後一筆。
  FY_CHAIN_1: { timeframe: 'FY', codes: ['revenuePerShare', 'costOfGoodsSoldPerShare', 'grossProfitPerShare', 'operatingExpensePerShare', 'otherOperatingIncomeExpensePerShare', 'operatingIncomePerShare', 'pretaxIncomePerShare', 'eps'], limit: 5 },
  FY_CHAIN_2: { timeframe: 'FY', codes: ['nonOperatingIncomePerShare', 'incomeTaxExpensePerShare', 'minorityInterestPerShare', 'sellingExpensePerShare', 'administrativeExpensePerShare', 'researchAndDevelopmentExpensePerShare'], limit: 5 },
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
  TTM_CYCLE_20: { timeframe: 'TTM', codes: ['inventoryDays', 'receivablesDays', 'payablesDays', 'operatingCycle', 'cashConversionCycle', 'inventoryToRevenueRatio'], limit: 20 },
  TTM_CORE_40: { timeframe: 'TTM', codes: ['eps', 'roe', 'roa', 'grossMargin', 'operatingMargin', 'netProfitMargin', 'ocfPerShare', 'fcfPerShare', 'dividendPerShare', 'dividendPayoutRatio'], limit: 40 },
  TTM_EXTRA_40: { timeframe: 'TTM', codes: ['revenuePerShare', 'peRatio'], limit: 40 },
  Q_4_40: { timeframe: 'Q', codes: ['debtRatio', 'currentRatio', 'pbRatio', 'bvps'], limit: 40 },
  // 淨值從哪來那一頁的稀釋對照。三支一起拿，因為重點就是前兩支的差＝股數稀釋——分開拿會讓「同一期
  // 的兩個成長率」落在不同快取世代，而那個差正好是整段要講的東西。
  // 只有 Q：equityGrowthRate.FY 和 .TTM 上游都不是可查詢欄位（2026-09-27 實測）。28 期覆蓋 2330
  // 的 27 期，是目前最深的。
  Q_EQUITY_28: { timeframe: 'Q', codes: ['equityGrowthRate', 'bvpsGrowthRate', 'bvps'], limit: 28 }
} satisfies Record<string, SeriesGroupPlan>

export type SeriesGroupName = keyof typeof SERIES_GROUPS

interface SeriesPagePlan {
  groups: SeriesGroupName[]
  badges?: boolean
  dividendHistory?: boolean
  // Implies dividendHistory — the fills are computed FROM it, plus the daily closes.
  dividendFills?: boolean
  // Field whose payers-only percentile to derive from `ranks`（see payerPercentileFrom）.
  payerPercentileField?: string
  ranks?: { field: string; direction: 'asc' | 'desc'; excludeZero?: boolean }[]
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
  // excludeZero: true (2026-09-20, analysis-ts's own recommendation) — a company IS ranked
  // against payers only, not diluted by the ~16% of the market that pays no dividend at all.
  dividend: { groups: ['TTM_DIV_40', 'FY_CORE_1'], dividendHistory: true, dividendFills: true, payerPercentileField: 'dividendYield.EOD', ranks: [{ field: 'dividendYield.EOD', direction: 'desc', excludeZero: true }] },
  // 配息從哪來（2026-09-24）— no new group: TTM_CORE_1 already carries the three margins, eps and
  // dividendPayoutRatio, and TTM_PER_SHARE_1 already carries revenuePerShare plus the per-share
  // cash figures. Between them every link of the chain is covered, so this page costs one more
  // cache key rather than one more upstream call shape.
  //
  // The final hop（÷ 股價）is deliberately NOT here: dividendYield's only cadence is EOD, so it
  // comes off the summary endpoint with the price it was computed from, never from this series.
  // That mismatch is the page's own subject, not a gap — see the page's second question.
  // dividendHistory 2026-09-25: 盈餘發放率改讀盈餘所屬年度（見那一頁自己的註解）。這支端點的
  // fiscalYear 就是盈餘歸屬年度不是發放年度，而近四季那支的分子是發放窗口——兩者答的是不同問題。
  'dividend-source': { groups: ['FY_CHAIN_1', 'FY_CHAIN_2'], dividendHistory: true },
  // 現金循環的組成（2026-09-26）。五支一組拿，因為這一頁的重點就是它們互相加減得出來——分開拿會讓
  // 「同一期的五個數字」變成五次可能落在不同快取世代的讀取，而那正好會讓恆等式在畫面上對不起來。
  //
  // 只有 TTM：這六支上游沒有 Q 也沒有 FY（2026-09-26 實測）。20 期是刻意的——最深的 2330 有 24 期、
  // 典型 19 期，取 20 不會浪費也不會截掉多少。
  'cash-cycle': { groups: ['TTM_CYCLE_20'] },
  'equity-source': { groups: ['Q_EQUITY_28'] },
  'metrics-history': { groups: ['TTM_CORE_40', 'Q_CORE_1', 'TTM_EXTRA_40', 'Q_4_40'] },
  'financial-statements': { groups: ['TTM_PER_SHARE_1', 'Q_BVPS_1'] }
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
  const [groupResults, badges, dividendHistory, dailyCloses, ranks] = await Promise.all([
    Promise.all(
      plan.groups.map(async name => {
        const group = SERIES_GROUPS[name]
        return [name, await settle(cachedMetricsHistory(symbol, group.timeframe, group.codes, group.limit))] as const
      })
    ),
    plan.badges ? settle(cachedBadges(symbol)) : Promise.resolve(undefined),
    plan.dividendHistory ? settle(cachedDividendHistory(symbol)) : Promise.resolve(undefined),
    plan.dividendFills ? settle(cachedDailyCloses(symbol)) : Promise.resolve(undefined),
    plan.ranks
      ? Promise.all(plan.ranks.map(async ({ field, direction, excludeZero }) => ({ field, direction, rank: await settle(cachedCompanyRank(symbol, field, direction, excludeZero)) })))
      : Promise.resolve(undefined)
  ])
  const groups: StockSeriesResponse['groups'] = {}
  for (const [name, series] of groupResults) groups[name] = series
  const response: StockSeriesResponse = { symbol, page, groups }
  if (badges !== undefined) response.badges = badges
  if (dividendHistory !== undefined) response.dividendHistory = dividendHistory
  // Both inputs can fail independently; either one missing means no fills rather than a partial
  // table, since a row without its pre-ex close says nothing.
  if (dailyCloses !== undefined) response.dividendFills = computeDividendFills(dividendHistory ?? null, dailyCloses ?? [])
  if (ranks !== undefined) response.ranks = ranks
  if (plan.payerPercentileField) {
    response.payerPercentile = payerPercentileFrom(ranks?.find(item => item.field === plan.payerPercentileField)?.rank)
  }
  return response
}
