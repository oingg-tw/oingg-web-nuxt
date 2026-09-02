// Confirmed live with bff-ts 2026-09-01: GET /market/revenue-ranking — 月營收排行
// (yoy/mom/當月營收), TWSE+TPEx merged. metric and order are required params on their side.
// Every ranking value is a string, same convention as everywhere else.
export type RevenueRankingMetric = 'yoy' | 'mom' | 'revenue'

export interface RevenueRankingRow {
  rank: number
  symbol: string
  name: string | null
  market: 'TWSE' | 'TPEx'
  currentMonthRevenue: string
  momChangePercent: string
  yoyChangePercent: string
}

export interface RevenueRanking {
  yearMonth: string
  metric: RevenueRankingMetric
  order: 'asc' | 'desc'
  limit: number
  rankings: RevenueRankingRow[]
  warnings: string[]
}

function fallback(metric: RevenueRankingMetric, limit: number): RevenueRanking {
  return { yearMonth: '', metric, order: 'desc', limit, rankings: [], warnings: ['offline fallback'] }
}

// Was a single fetch (metric=revenue) re-sorted client-side per metric toggle, on the
// assumption that "not quite the true top-20 for mom/yoy" was an acceptable tradeoff since
// revenue only updates once a day. A real user report (relayed via analysis-ts 2026-09-02)
// showed that assumption was wrong in practice: re-sorting the top-20-by-revenue subset by yoy
// produces a completely different set of companies than the true top-20-by-yoy (largest
// companies' growth rates vs. actually-fastest-growing companies are unrelated dimensions) —
// e.g. 國泰人壽's real -69.71% mom showed up under "年增率" not because it ranked there, but
// because it's simply one of Taiwan's largest companies by absolute revenue. Fixed with the
// same per-metric fetch+cache pattern as useEtfRanking.ts (each metric fetched at most once
// per session, cached client-side) instead of one fetch + local re-sort.
export function useRevenueRanking(metric: Ref<RevenueRankingMetric>, limit = 20) {
  const config = useRuntimeConfig()
  const cache = useState<Partial<Record<RevenueRankingMetric, RevenueRanking>>>('revenue-ranking-cache', () => ({}))

  async function fetchMetric(targetMetric: RevenueRankingMetric): Promise<RevenueRanking> {
    try {
      return await $fetch<RevenueRanking>('/market/revenue-ranking', {
        baseURL: config.public.apiBase,
        query: { metric: targetMetric, order: 'desc', limit }
      })
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(
          `[revenue-ranking] GET ${config.public.apiBase}/market/revenue-ranking unavailable (${reason}), using fallback instead`
        )
      }
      return fallback(targetMetric, limit)
    }
  }

  const asyncData = useAsyncData<RevenueRanking>('revenue-ranking', async () => {
    const targetMetric = metric.value
    if (cache.value[targetMetric]) return cache.value[targetMetric]!
    const result = await fetchMetric(targetMetric)
    cache.value[targetMetric] = result
    return result
    // lazy + server:false — see dashboard.vue's own comment on why every dashboard composable
    // does this (one slow endpoint shouldn't block the whole page's SSR response; lazy alone
    // doesn't skip that — server:false is what actually keeps the fetch off the SSR path).
  }, { default: () => fallback(metric.value, limit), lazy: true, server: false })

  watch(metric, async targetMetric => {
    const cached = cache.value[targetMetric]
    if (cached) {
      asyncData.data.value = cached
      return
    }
    const result = await fetchMetric(targetMetric)
    cache.value[targetMetric] = result
    asyncData.data.value = result
  })

  return asyncData
}
