import { createHash } from 'node:crypto'
import type { MetricsHistoryEntry, MetricsHistorySeries, MetricsHistoryTimeframe } from '#shared/types/metrics-history'
import type { StockBadges } from '#shared/types/stock-badges'
import type { FinancialStatementResponse, StatementType } from '#shared/types/financial-statement'
import type { StockBookValueBreakdownResponse } from '#shared/types/stock-equity-composition'
import type { DividendFillEvent, DividendHistoryResponse } from '#shared/types/dividend-history'
import type { StockSeriesPage, StockSeriesResponse } from '#shared/types/stock-series'
import type { MetricProvenanceResponse } from '#shared/types/metric-provenance'

// Per-symbol 業務中台 data behind the /stock/:code pages, each wrapped in Nitro's
// defineCachedFunction (2026-09-19, the SEO build). Why a server cache layer instead of the
// browser-side composables fetching 業務中台 directly: a crawler renders every one of ~2,650
// symbols × 6 pages cold, and each render used to fan out 7–13 uncached upstream calls — about
// 25 pages a minute already exhausted 業務中台's 300 req/60s limit, and the render that hit the
// limit got indexed as the thin version. With these, a warm page costs the upstream 0–3 calls.
//
// Rules shared by every function here:
// - businessFetch throws on failure → nothing is cached for that key; an existing stale entry is
//   served (swr) while the refresh fails in the background, so a 業務中台 outage degrades to stale
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

// 個股頁面 SSR 要抓幾期歷史。五個路由各寫一次 `const HISTORY_LIMIT = 20`，2026-10-02 收成一份。
//
// 20 期的理由寫在 metric.get.ts 的檔頭（簡述：近 5 年的季資料，想看近 8 年的讀者可以用圖表自己的
// 選擇器，那是一次 client 端查詢、在這一頁的 SSR 深度之外）。那段理由跟著這個常數一起讀。
//
// 名字帶 STOCK_ 前綴是刻意的：server/utils 的 export 在整個 Nitro 端自動匯入，叫 HISTORY_LIMIT
// 這種通名遲早會被某個檔案的同名區域變數靜默遮蔽。
export const STOCK_HISTORY_LIMIT = 20

export const cachedMetricsHistory = defineCachedFunction(
  async (symbol: string, timeframe: MetricsHistoryTimeframe, codes: string[], limit: number): Promise<MetricsHistorySeries> => {
    const response = await businessFetch<MetricsHistoryResponse>(`/stocks/${symbol}/metrics-history`, {
      // 查詢參數 timeframe（2026-10-10 起；原本是 basis，見 useMetricsHistory.ts）
      query: { metricCodes: codes.join(','), timeframe, limit }
    })
    return { timeframe, codes, limit, entries: response.entries, total: response.total }
  },
  {
    name: 'stock-metrics-history',
    // unstorage 的 fs driver 把 key 當路徑用，`:` 變成目錄分隔，所以 codes 那一段就是檔名。
    // 八支每股費用指標 join 起來是 266 字元、整條路徑 375——**超過 Windows 的 MAX_PATH 260**，
    // 寫入永遠 ENOENT，於是這一支快取在 Windows 上從來沒成功過，每次請求都重打 業務中台
    // （2026-10-02 量到：dev log 持續噴 `[cache] Cache write error`，路徑 375 字元）。
    //
    // 短 key 刻意維持原樣：我們常手動刪特定快取鍵，可讀的檔名有實際價值（見
    // nitro-cache-invisible-dotfile 那次）。只有超長的才換成雜湊。門檻用路徑預算推導：
    // repo 根 39＋`.nuxt/cache/nitro/functions/` 29＋`stock-metrics-history/` 22＋
    // `symbol/timeframe/limit/` 約 13＋`.json` 5 ＝ 108，剩 152 給檔名，取 100 留餘裕。
    getKey: (symbol, timeframe, codes, limit) => {
      const joined = codes.join(',')
      const name = joined.length <= 100 ? joined : createHash('sha1').update(joined).digest('hex').slice(0, 16)
      return `${symbol}:${timeframe}:${limit}:${name}`
    },
    maxAge: TTL_FUNDAMENTALS,
    staleMaxAge: TTL_STATIC,
    swr: true
  }
)

export const cachedBadges = defineCachedFunction(
  (symbol: string) => businessFetch<StockBadges>(`/stocks/${symbol}/badges`),
  { name: 'stock-badges', getKey: symbol => symbol, maxAge: TTL_FUNDAMENTALS, staleMaxAge: TTL_STATIC, swr: true }
)

export const cachedDividendHistory = defineCachedFunction(
  (symbol: string) => businessFetch<DividendHistoryResponse>(`/stocks/${symbol}/dividend-history`),
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
  // 股數；ETF 成交量頁用（2026-10-18）
  volume?: number | null
}

// 無成交日的收盤價是 0，不是當天真的跌到零（2026-09-27，業務中台 抽查 51 檔有 4 檔出現，1538 最近
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
    const response = await businessFetch<{ entries: DailyClose[] }>(`/stocks/${symbol}/daily-price-history`, { query: { limit: DAILY_PRICE_ROWS } })
    return [...(response.entries ?? [])].filter(isRealClose).sort((a, b) => a.tradeDate.localeCompare(b.tradeDate))
  },
  { name: 'stock-daily-closes', getKey: symbol => symbol, maxAge: TTL_FUNDAMENTALS, staleMaxAge: TTL_STATIC, swr: true }
)

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
      let broken = false
      for (let i = exIndex; i < daily.length; i += 1) {
        if (daily[i]!.close >= preExClose) {
          filledDate = daily[i]!.tradeDate
          tradingDays = i - exIndex
          break
        }
        // 除息日之後股價有一次不是漲跌的跳動（分割、減資、之後另一次除權息；0050 2025-06 一拆四）：之後的收盤價跟除息前不是同一個股數基準，
        // 再比下去會說「一直沒填息」。除息日本身那一跳就是配息，不算（2026-10-18）
        if (i > exIndex && isPriceBreak(daily[i - 1]!.close, daily[i]!.close)) {
          broken = true
          break
        }
      }
      fills.push(broken ? { ...base, preExClose, unavailableReason: 'price-break' } : { ...base, preExClose, filledDate, tradingDays })
    }
  }
  // Newest first, the same order the 歷年股利 table already uses.
  return fills.sort((a, b) => b.exDividendDate.localeCompare(a.exDividendDate))
}

// GET /stocks/:symbol/metric-provenance — the badge pages' calculation-audit table
// (app/pages/stock/[code]/[slug].vue, 2026-09-20). Confirmed live: /stocks/2330/metric-
// provenance?metricCode=roe returns real statement-field entries.
export const cachedMetricProvenance = defineCachedFunction(
  (symbol: string, metricCode: string) => businessFetch<MetricProvenanceResponse>(`/stocks/${symbol}/metric-provenance`, { query: { metricCode } }),
  { name: 'stock-metric-provenance', getKey: (symbol, metricCode) => `${symbol}:${metricCode}`, maxAge: TTL_FUNDAMENTALS, staleMaxAge: TTL_STATIC, swr: true }
)

// cachedPeerGroup / cachedPeerValues (GET /stocks/:symbol/peer-group, POST /screener/values for
// the peer table) removed 2026-09-20 — analysis-ts hard-deleted GET /companies/peer-group with
// no replacement (commit a7489d65).

// GET /stocks/:symbol/financial-statement — 查詢參數是西元 fiscalYear＋整數 fiscalQuarter（2026-10-10 業務中台 d8f4753，
// 取代民國 year＋字串 season）；兩個都不帶＝最新一期。回應的期別也是西元 fiscalYear／fiscalQuarter（2026-10-10 起）；科目 key 是 mops 第三階段（2026-10-12）之後的長名。
export const cachedFinancialStatement = defineCachedFunction(
  (symbol: string, statementType: StatementType, fiscalYear: number | null, fiscalQuarter: number | null) =>
    businessFetch<FinancialStatementResponse>(`/stocks/${symbol}/financial-statement`, {
      query: fiscalYear && fiscalQuarter ? { statementType, fiscalYear, fiscalQuarter } : { statementType }
    }),
  {
    name: 'stock-financial-statement',
    getKey: (symbol, statementType, fiscalYear, fiscalQuarter) => `${symbol}:${statementType}:${fiscalYear ?? 'latest'}:${fiscalQuarter ?? 'latest'}`,
    maxAge: TTL_STATEMENTS,
    staleMaxAge: TTL_STATIC,
    swr: true
  }
)

// (year, quarter) 之前的 count 季財報，由新到舊；讀不到的是 null。逐季組成的兩支（資產負債、現金流量）共用
export function cachedEarlierStatements(symbol: string, statementType: StatementType, year: number, quarter: number, count: number) {
  const latest = year * 4 + quarter - 1
  return Promise.all(Array.from({ length: count }, (_, i) => {
    const index = latest - 1 - i
    return settle(cachedFinancialStatement(symbol, statementType, Math.floor(index / 4), (index % 4) + 1))
  }))
}

// GET /stocks/:symbol/book-value-breakdown — 每股淨值的逐年變動拆解（業務中台 2026-09-27 上線）。
// 查無權益變動表回 entries: []（200，不是 404），所以呼叫端不需要處理 404。
// Go 換版並存（contract-delta A8）：本期淨利 netIncome 改叫 IFRS 名 profitLossAttributableToOrdinaryEquityHoldersOfParentEntityPerShare
export const cachedBookValueBreakdown = defineCachedFunction(
  async (symbol: string): Promise<StockBookValueBreakdownResponse> => {
    const response = await businessFetch<StockBookValueBreakdownResponse>(`/stocks/${symbol}/book-value-breakdown`)
    return {
      ...response,
      entries: response.entries.map(entry => ({ ...entry, netIncome: entry.netIncome ?? (entry as unknown as Record<string, number>).profitLossAttributableToOrdinaryEquityHoldersOfParentEntityPerShare! }))
    }
  },
  { name: 'stock-book-value-breakdown', getKey: symbol => symbol, maxAge: TTL_STATEMENTS, staleMaxAge: TTL_STATIC, swr: true }
)

// ---- Page plans for /api/stock/:code/series ------------------------------------------------
//
// Every group is timeframe-pure（業務中台 400s a whole request if one code doesn't support the
// basis）and ≤ 10 codes（業務中台's cap）; each code's allowed timeframes were checked against
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
  FY_CORE_1: { timeframe: 'FY', codes: ['consecutiveDividendYears', 'dividendGrowthRate5y', 'epsCagr5y', 'revenueCagr5y', 'consecutiveProfitYears', 'chowderNumber'], limit: 1 },
  TTM_PER_SHARE_1: { timeframe: 'TTM', codes: ['revenuePerShare', 'eps', 'ocfPerShare', 'fcfPerShare', 'dividendPerShare'], limit: 1 },
  // 配息從哪來整頁改成年度（2026-09-25，使用者定案「整頁改成年度」）。損益表那條鏈的 15 支每股金額
  // 在同一天全部拿得到 FY 了，所以瀑布圖不必再用三率去推導金額——直接讀申報值，而且鏈的最後一格就是
  // 年報公告的 EPS。股利那一格從 dividend-history 讀，它的 fiscalYear 是盈餘所屬年度，跟這裡的
  // 會計年度是同一年，所以整條鏈第一次落在同一段盈餘上。
  //
  // 拆兩組是因為 metricCodes 上限是 10（實測送 12 個回 400）。limit 5 而不是 1：最新年度不一定完整
  // ——773 家的 114 年報還沒匯入，抽樣 20 檔有 14 檔最新只到 113 年度——所以要往回找第一個「每個科目
  // 都有值」的年度，不能只拿最後一筆。
  FY_CHAIN_1: { timeframe: 'FY', codes: ['revenuePerShare', 'operatingCostsPerShare', 'grossProfitPerShare', 'operatingExpensePerShare', 'netOtherIncomeExpensesPerShare', 'operatingIncomePerShare', 'pretaxIncomePerShare', 'eps'], limit: 5 },
  FY_CHAIN_2: { timeframe: 'FY', codes: ['nonOperatingIncomeExpensesPerShare', 'incomeTaxExpensePerShare', 'nonControllingInterestsPerShare', 'sellingExpensePerShare', 'administrativeExpensePerShare', 'researchAndDevelopmentExpensePerShare', 'preferredDividendsPerShare'], limit: 5 },
  Q_BVPS_1: { timeframe: 'Q', codes: ['bvps'], limit: 1 },
  // The stock's own PE/PB quarterly history for the digest's percentile sentences.
  PE_TTM_20: { timeframe: 'TTM', codes: ['peRatio'], limit: 20 },
  PB_Q_20: { timeframe: 'Q', codes: ['pbRatio'], limit: 20 },
  // 公司健檢 — one 20-quarter 單季 table per section, 5 calls for 41 codes.
  // 配股配息 — the 配息數列 table（all available quarters）; StockDividendCashChainCard's four
  // codes are a subset, so that card renders in SSR from this group.
  TTM_DIV_40: { timeframe: 'TTM', codes: ['dividendPerShare', 'dividendPayoutRatio', 'dividendCoverageRatio', 'shareholderYield', 'buybackYield', 'fcfPerShare', 'ocfPerShare', 'eps'], limit: 40 },
  TTM_CYCLE_20: { timeframe: 'TTM', codes: ['inventoryDays', 'receivablesDays', 'payablesDays', 'operatingCycle', 'cashConversionCycle', 'inventoryToRevenueRatio'], limit: 20 },
} satisfies Record<string, SeriesGroupPlan>

export type SeriesGroupName = keyof typeof SERIES_GROUPS

interface SeriesPagePlan {
  groups: SeriesGroupName[]
  dividendHistory?: boolean
  // Implies dividendHistory — the fills are computed FROM it, plus the daily closes.
  dividendFills?: boolean
}

// Order matters: the digest keeps the FIRST group that carries a code, so the TTM "latest"
// groups come before the 單季 tables' groups on pages that have both（近四季 EPS in the lead
// sentence, 單季 EPS in the table）.
const SERIES_PLANS: Record<StockSeriesPage, SeriesPagePlan> = {
  // FY_CORE_1 feeds the index page's FAQ（連續配息年數）.
  index: { groups: ['TTM_CORE_1', 'FY_CORE_1', 'PE_TTM_20', 'PB_Q_20'] },
  // 殖利率在全市場（有配息公司）的排名與百分位 2026-10-23 拿掉：頁面 10/15 就不畫了（使用者：「跟其他配息公司比，殖利率在哪裡
  // 這個先刪掉。我另外想想怎麼辦」），每次讀這頁還多打一次 GET /screener/company-rank。要放回來從 git 找 cachedCompanyRank
  dividend: { groups: ['TTM_DIV_40', 'FY_CORE_1'], dividendHistory: true, dividendFills: true },
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
  'financial-statements': { groups: ['TTM_PER_SHARE_1', 'Q_BVPS_1'] }
}

export function isStockSeriesPage(value: string): value is StockSeriesPage {
  return Object.prototype.hasOwnProperty.call(SERIES_PLANS, value)
}

export async function runStockSeriesPlan(symbol: string, page: StockSeriesPage): Promise<StockSeriesResponse> {
  const plan = SERIES_PLANS[page]
  const [groupResults, dividendHistory, dailyCloses] = await Promise.all([
    Promise.all(
      plan.groups.map(async name => {
        const group = SERIES_GROUPS[name]
        return [name, await settle(cachedMetricsHistory(symbol, group.timeframe, group.codes, group.limit))] as const
      })
    ),
    plan.dividendHistory ? settle(cachedDividendHistory(symbol)) : Promise.resolve(undefined),
    plan.dividendFills ? settle(cachedDailyCloses(symbol)) : Promise.resolve(undefined)
  ])
  const groups: StockSeriesResponse['groups'] = {}
  for (const [name, series] of groupResults) groups[name] = series
  const response: StockSeriesResponse = { symbol, page, groups }
  if (dividendHistory !== undefined) response.dividendHistory = dividendHistory
  // Both inputs can fail independently; either one missing means no fills rather than a partial
  // table, since a row without its pre-ex close says nothing.
  if (dailyCloses !== undefined) response.dividendFills = computeDividendFills(dividendHistory ?? null, dailyCloses ?? [])
  return response
}
