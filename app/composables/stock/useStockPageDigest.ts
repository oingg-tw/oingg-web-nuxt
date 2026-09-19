import type { MetricsHistorySeries } from '#shared/types/metrics-history'
import type { PiotroskiBreakdown } from '#shared/types/piotroski'
import type { StockSeriesPage, StockSeriesResponse } from '#shared/types/stock-series'
import type { CachedHistory } from '~/composables/stock/useMetricsHistory'
import { metricsHistoryCacheKey, useMetricsHistorySupersetIndex } from '~/composables/stock/useMetricsHistory'
import type { CachedBadges } from '~/composables/stock/useStockBadges'
import type { ExDividendNotice } from '~/composables/stock/useExDividendNotices'
import type { StockDigestGroupResult, StockDigestPage, StockPageDigest } from '~/utils/stock-digest'
import { buildStockMetaDescription, buildStockPageDigest } from '~/utils/stock-digest'

// One page-level useAsyncData per /stock/:code sub-page (2026-09-19, the stock-page a11y/SEO
// redesign) that puts REAL numbers into the server-rendered HTML. Before this, every card on these
// pages fetched client-side ($fetch inside a watch — useMetricsHistory/useStockBadges/…), so the
// HTML a crawler received held the company name, one price and three ratios, and nothing else.
//
// Since the SEO build later the same day, the fetch is ONE same-origin call to
// /api/stock/:code/series?page=… (server/api/stock/[code]/series.get.ts): the per-page plan of
// metric groups（≤10 codes each, timeframe-pure）, badges, the Piotroski breakdown and the
// dividend history live on the server behind Nitro's cache（server/utils/stock-data.ts）. During
// SSR that call is an in-process function call; from the browser it is a same-origin request
// that never reaches bff-ts. The groups come back with their own request parameters, and the
// bigger ones（×20／×40 periods）feed the pages' visible tables（Phase 2 of the SEO build）.
//
// The bonus that makes existing cards render in SSR too: every successful group is written into
// the SAME useState caches those composables read（'metrics-history-cache' keyed by
// metricsHistoryCacheKey(), 'stock-badges-cache' keyed by symbol）and listed in the superset index
// (useMetricsHistory.ts) — a card whose own request is a subset of a pre-warmed series then takes
// load()'s synchronous cache-hit path, renders real content on the server, and hydrates from the
// serialized state without refetching. The cache entries share the payload's own arrays（devalue
// serializes a shared reference once）, so pre-warming costs no extra payload bytes. A key that
// doesn't line up costs at most one extra client request, never a mismatch: the guards in those
// composables never fire a request on the server on a miss.
//
// Everything reactive is set up BEFORE the single await (Nuxt's asyncContext is off, so a composable
// call after an await inside this function would lose the Nuxt instance).

const REQUEST_TIMEOUT_MS = 15_000

export interface UseStockPageDigestOptions {
  // The page's own stockShortName (from useStockDetailSummary) — for the meta description.
  shortName: Ref<string>
  // The dividend page's already-SSR'd ex-dividend notices（useExDividendNotices）, so its lead
  // sentence can quote the next ex-date without a second fetch.
  exDividendNotices?: Ref<Record<string, ExDividendNotice[]> | null | undefined>
}

// The first group on the page that carries `code` at `timeframe` with at least `minPeriods`
// entries — the digest's PE/PB percentile sentences read the stock's own quarterly history from
// whichever group happens to hold it（PE_TTM_20 on the index page, TTM_A_20 on 公司健檢, …）.
export function findSeriesWithCode(groups: StockSeriesResponse['groups'], code: string, timeframe: MetricsHistorySeries['timeframe'], minPeriods: number): MetricsHistorySeries | null {
  for (const series of Object.values(groups)) {
    if (series && series.timeframe === timeframe && series.limit >= minPeriods && series.codes.includes(code)) return series
  }
  return null
}

const VALUATION_HISTORY_QUARTERS = 20

// `page` is the series plan's name; 'f-score' has a plan（badges, breakdown, score history）but
// no digest text — that page returns `series` only and `digest` stays null.
function isDigestPage(page: StockSeriesPage): page is StockDigestPage {
  return page !== 'f-score'
}

export async function useStockPageDigest(code: Ref<string>, page: StockSeriesPage, options: UseStockPageDigestOptions) {
  // Already awaited by the page before this runs (the shared-key rule) — a cache hit here.
  const { data: schema } = useFilterSchema()
  // Same key as useStockDetailSummary's own call → deduped, not a second request.
  const { data: summary } = useStockSummary(code)
  const historyCache = useState<Record<string, CachedHistory>>('metrics-history-cache', () => ({}))
  const supersetIndex = useMetricsHistorySupersetIndex()
  const badgesCache = useState<Record<string, CachedBadges>>('stock-badges-cache', () => ({}))
  const breakdownCache = useState<Record<string, PiotroskiBreakdown | null>>('piotroski-breakdown-cache', () => ({}))

  const asyncData = useAsyncData<StockSeriesResponse | null>(
    () => `stock-series-${page}-${code.value}`,
    async () => {
      const symbol = code.value
      if (!symbol) return null
      try {
        return await $fetch<StockSeriesResponse>(`/api/stock/${symbol}/series`, { query: { page }, retry: 0, timeout: REQUEST_TIMEOUT_MS })
      } catch (error) {
        if (import.meta.dev) {
          const reason = error instanceof Error ? error.message : String(error)
          console.warn(`[stock-digest] GET /api/stock/${symbol}/series?page=${page} unavailable (${reason})`)
        }
        return null
      }
    },
    { watch: [code], default: () => null }
  )

  // Cache pre-warm — runs from the same payload on the server (before the cards' setup) and on
  // the client (idempotent re-write of what the payload already restored), so both renders see
  // identical caches. Failed groups（null）are skipped so a card's own load() can retry them.
  // Called explicitly right after the await below rather than through an immediate watcher: in
  // SSR Vue runs an `immediate` watcher exactly once during setup（with the still-null data）and
  // never again, so a watcher-only version silently skipped the server（found live 2026-09-19:
  // the pre-warmed cards dropped out of the SSR HTML）. The plain watcher registered before the
  // await covers client-side navigations between symbols.
  function prewarm(payload: StockSeriesResponse | null) {
    if (!payload) return
    for (const series of Object.values(payload.groups)) {
      if (!series) continue
      const key = metricsHistoryCacheKey(payload.symbol, series.codes, series.timeframe, series.limit)
      historyCache.value[key] = { entries: series.entries, total: series.total }
      if (!supersetIndex.value.some(entry => entry.key === key)) {
        supersetIndex.value.push({ symbol: payload.symbol, timeframe: series.timeframe, codes: series.codes, limit: series.limit, key })
      }
    }
    if (payload.badges && !(payload.symbol in badgesCache.value)) badgesCache.value[payload.symbol] = payload.badges
    if (payload.breakdown && !(payload.symbol in breakdownCache.value)) breakdownCache.value[payload.symbol] = payload.breakdown
  }
  watch(asyncData.data, prewarm)

  await asyncData
  prewarm(asyncData.data.value)

  const digest = computed<StockPageDigest | null>(() => {
    const payload = asyncData.data.value
    const categories = schema.value?.categories
    if (!payload || payload.symbol !== code.value || !categories || !isDigestPage(page)) return null
    const latest: Record<string, StockDigestGroupResult> = {}
    for (const [name, series] of Object.entries(payload.groups)) {
      if (series) latest[name] = { timeframe: series.timeframe, entries: series.entries }
    }
    // Nearest ex-date first — same pick StockExDividendCard.vue makes (the API doesn't sort).
    const notices = options.exDividendNotices?.value?.[code.value] ?? []
    const nextExDividend = notices.length ? [...notices].sort((a, b) => a.exDate.localeCompare(b.exDate))[0]! : null
    return buildStockPageDigest({
      page,
      categories,
      latest,
      peHistory: findSeriesWithCode(payload.groups, 'peRatio', 'TTM', VALUATION_HISTORY_QUARTERS)?.entries ?? null,
      pbHistory: findSeriesWithCode(payload.groups, 'pbRatio', 'Q', VALUATION_HISTORY_QUARTERS)?.entries ?? null,
      summary: summary.value ?? null,
      nextExDividend
    })
  })

  const description = computed(() => buildStockMetaDescription(options.shortName.value, code.value, digest.value))

  return { digest, description, pending: asyncData.pending, series: asyncData.data }
}
