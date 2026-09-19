import type { CachedHistory, MetricsHistoryEntry, MetricsHistoryTimeframe } from '~/composables/stock/useMetricsHistory'
import { metricsHistoryCacheKey } from '~/composables/stock/useMetricsHistory'
import type { CachedBadges, StockBadges } from '~/composables/stock/useStockBadges'
import type { ExDividendNotice } from '~/composables/stock/useExDividendNotices'
import type { StockDigestGroupResult, StockDigestPage, StockPageDigest } from '~/utils/stock-digest'
import { buildStockMetaDescription, buildStockPageDigest } from '~/utils/stock-digest'

// One page-level useAsyncData per /stock/:code sub-page (2026-09-19, the stock-page a11y/SEO
// redesign) that puts REAL numbers into the server-rendered HTML. Before this, every card on these
// pages fetched client-side ($fetch inside a watch — useMetricsHistory/useStockBadges/…), so the
// HTML a crawler received held the company name, one price and three ratios, and nothing else.
//
// Why a separate page-level fetch instead of making those card composables SSR-aware: they have
// four reactive inputs, chunking, cross-instance in-flight dedupe and a "latest wins" guard that
// useAsyncData's own dedupe semantics would change, and 公司健檢 alone mounts 24 cards × 20
// quarters — 40–60 requests per SSR just to draw charts. This fetches a small, fixed set of
// "latest period" groups (≤10 codes each, every group timeframe-pure — bff-ts 400s a whole
// request if one code doesn't support the basis; verified against GET /metrics' own field keys)
// plus, where a page shows them, the stock's own PE/PB quarterly history for a percentile sentence.
// 4–7 parallel requests, ~0.5s wall-clock on the dev backend.
//
// The bonus that makes existing cards render in SSR too: every successful group is written into
// the SAME useState caches those composables read（'metrics-history-cache' keyed by
// metricsHistoryCacheKey(), 'stock-badges-cache' keyed by symbol）. A card whose own call resolves
// to an identical key then takes load()'s synchronous cache-hit path, renders real content on the
// server, and hydrates from the serialized state without refetching — TTM_CASH_CHAIN below is
// StockDividendCashChainCard's exact codes/order/limit for that reason. A key that doesn't line up
// costs at most one extra client request, never a mismatch: the guards in those composables never
// fire a request on the server on a miss.
//
// Everything reactive is set up BEFORE the single await (Nuxt's asyncContext is off, so a composable
// call after an await inside this function would lose the Nuxt instance).

type GroupName = 'TTM_CORE' | 'Q_CORE' | 'TTM_RESILIENCE' | 'FY_CORE' | 'TTM_DIVIDEND' | 'TTM_CASH_CHAIN' | 'TTM_PER_SHARE' | 'Q_BVPS'

const GROUPS: Record<GroupName, { timeframe: MetricsHistoryTimeframe; codes: string[] }> = {
  TTM_CORE: { timeframe: 'TTM', codes: ['eps', 'roe', 'roa', 'grossMargin', 'operatingMargin', 'netProfitMargin', 'ocfPerShare', 'fcfPerShare', 'dividendPerShare', 'dividendPayoutRatio'] },
  Q_CORE: { timeframe: 'Q', codes: ['debtRatio', 'currentRatio', 'quickRatio', 'piotroskiFScore', 'revenueGrowthRate', 'epsGrowthRate', 'netIncomeGrowthRate', 'pbRatio', 'bvps', 'shareCountChangeRate'] },
  TTM_RESILIENCE: { timeframe: 'TTM', codes: ['altmanZScore', 'interestCoverage', 'netDebtToEbitda', 'dividendCoverageRatio', 'shareholderYield', 'buybackYield'] },
  FY_CORE: { timeframe: 'FY', codes: ['consecutiveDividendYears', 'dividendGrowthRate5y', 'epsCagr5y', 'revenueCagr5y', 'consecutiveProfitYears', 'chowderNumber'] },
  TTM_DIVIDEND: { timeframe: 'TTM', codes: ['dividendPerShare', 'dividendPayoutRatio', 'dividendCoverageRatio', 'shareholderYield', 'buybackYield'] },
  // === StockDividendCashChainCard.vue's CASH_CHAIN_CODES, same order, limit 1 — cache-key match.
  TTM_CASH_CHAIN: { timeframe: 'TTM', codes: ['dividendPerShare', 'eps', 'ocfPerShare', 'fcfPerShare'] },
  TTM_PER_SHARE: { timeframe: 'TTM', codes: ['revenuePerShare', 'eps', 'ocfPerShare', 'fcfPerShare', 'dividendPerShare'] },
  // bvps only exists at Q (verified 2026-09-19), so it can't ride in a TTM group.
  Q_BVPS: { timeframe: 'Q', codes: ['bvps'] }
}

interface PagePlan {
  latest: GroupName[]
  // GET /stocks/:symbol/badges — only where a card on the page reads it（StockFinancialHighlightsRisksCard）.
  badges: boolean
  // peRatio(TTM)/pbRatio(Q) × 20 quarters for the percentile sentences.
  valuationHistory: boolean
}

const PAGE_PLAN: Record<StockDigestPage, PagePlan> = {
  index: { latest: ['TTM_CORE'], badges: true, valuationHistory: true },
  'company-health': { latest: ['TTM_CORE', 'Q_CORE', 'TTM_RESILIENCE', 'FY_CORE'], badges: false, valuationHistory: true },
  // TTM_CASH_CHAIN pre-warms StockDividendCashChainCard (on this page since 2026-09-19).
  dividend: { latest: ['TTM_DIVIDEND', 'FY_CORE', 'TTM_CASH_CHAIN'], badges: false, valuationHistory: false },
  'financial-statements': { latest: ['TTM_PER_SHARE', 'Q_BVPS'], badges: false, valuationHistory: false },
  'metrics-history': { latest: ['TTM_CORE', 'Q_CORE'], badges: false, valuationHistory: false }
}

const VALUATION_HISTORY_LIMIT = 20
const REQUEST_TIMEOUT_MS = 8000

interface MetricsHistoryResponse {
  total: number
  entries: MetricsHistoryEntry[]
}

// What the page's useAsyncData stores（small: limit-1 entries per group + two 20-quarter series）.
interface StockDigestPayload {
  symbol: string
  latest: Partial<Record<GroupName, StockDigestGroupResult>>
  peHistory: MetricsHistoryEntry[] | null
  pbHistory: MetricsHistoryEntry[] | null
}

export interface UseStockPageDigestOptions {
  // The page's own stockShortName (from useStockDetailSummary) — for the meta description.
  shortName: Ref<string>
  // The dividend page's already-SSR'd ex-dividend notices（useExDividendNotices）, so its lead
  // sentence can quote the next ex-date without a second fetch.
  exDividendNotices?: Ref<Record<string, ExDividendNotice[]> | null | undefined>
}

export async function useStockPageDigest(code: Ref<string>, page: StockDigestPage, options: UseStockPageDigestOptions) {
  const config = useRuntimeConfig()
  // Already awaited by the page before this runs (the shared-key rule) — a cache hit here.
  const { data: schema } = useFilterSchema()
  // Same key as useStockDetailSummary's own call → deduped, not a second request.
  const { data: summary } = useStockSummary(code)
  const historyCache = useState<Record<string, CachedHistory>>('metrics-history-cache', () => ({}))
  const badgesCache = useState<Record<string, CachedBadges>>('stock-badges-cache', () => ({}))
  const plan = PAGE_PLAN[page]

  async function fetchGroup(symbol: string, codes: string[], timeframe: MetricsHistoryTimeframe, limit: number): Promise<{ entries: MetricsHistoryEntry[]; total: number } | null> {
    const key = metricsHistoryCacheKey(symbol, codes, timeframe, limit)
    const cached = historyCache.value[key]
    if (cached) return cached
    try {
      const result = await $fetch<MetricsHistoryResponse>(`/stocks/${symbol}/metrics-history`, {
        baseURL: config.public.apiBase,
        retry: 0,
        timeout: REQUEST_TIMEOUT_MS,
        query: { metricCodes: codes.join(','), basis: timeframe, limit }
      })
      const value = { entries: result.entries, total: result.total }
      historyCache.value[key] = value
      return value
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[stock-digest] GET /stocks/${symbol}/metrics-history?metricCodes=${codes.join(',')}&basis=${timeframe} unavailable (${reason})`)
      }
      return null
    }
  }

  async function fetchBadges(symbol: string): Promise<void> {
    if (symbol in badgesCache.value) return
    try {
      badgesCache.value[symbol] = await $fetch<StockBadges>(`/stocks/${symbol}/badges`, {
        baseURL: config.public.apiBase,
        retry: 0,
        timeout: REQUEST_TIMEOUT_MS
      })
    } catch (error) {
      // Not cached on failure — the card's own client-side load() retries it.
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[stock-digest] GET /stocks/${symbol}/badges unavailable (${reason})`)
      }
    }
  }

  const asyncData = useAsyncData<StockDigestPayload | null>(
    () => `stock-digest-${page}-${code.value}`,
    async () => {
      const symbol = code.value
      if (!symbol) return null
      const groupResults = await Promise.all(
        plan.latest.map(async name => {
          const group = GROUPS[name]
          const result = await fetchGroup(symbol, group.codes, group.timeframe, 1)
          return [name, result ? { timeframe: group.timeframe, entries: result.entries } : null] as const
        })
      )
      const [pe, pb] = plan.valuationHistory
        ? await Promise.all([
            fetchGroup(symbol, ['peRatio'], 'TTM', VALUATION_HISTORY_LIMIT),
            fetchGroup(symbol, ['pbRatio'], 'Q', VALUATION_HISTORY_LIMIT)
          ])
        : [null, null]
      if (plan.badges) await fetchBadges(symbol)
      const latest: StockDigestPayload['latest'] = {}
      for (const [name, result] of groupResults) {
        if (result) latest[name] = result
      }
      return { symbol, latest, peHistory: pe?.entries ?? null, pbHistory: pb?.entries ?? null }
    },
    { watch: [code], default: () => null }
  )
  await asyncData

  const digest = computed<StockPageDigest | null>(() => {
    const payload = asyncData.data.value
    const categories = schema.value?.categories
    if (!payload || payload.symbol !== code.value || !categories) return null
    // Nearest ex-date first — same pick StockExDividendCard.vue makes (the API doesn't sort).
    const notices = options.exDividendNotices?.value?.[code.value] ?? []
    const nextExDividend = notices.length ? [...notices].sort((a, b) => a.exDate.localeCompare(b.exDate))[0]! : null
    return buildStockPageDigest({
      page,
      categories,
      latest: payload.latest,
      peHistory: payload.peHistory,
      pbHistory: payload.pbHistory,
      summary: summary.value ?? null,
      nextExDividend
    })
  })

  const description = computed(() => buildStockMetaDescription(options.shortName.value, code.value, digest.value))

  return { digest, description, pending: asyncData.pending }
}
