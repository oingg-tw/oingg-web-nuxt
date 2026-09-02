// Confirmed live with bff-ts 2026-09-02: GET /market/etf-ranking?metric=&order=&limit= — ETF
// ranking. metric/order are required on their side; each metric returns a genuinely different
// top-N (and the single `value` field means something different per metric), so switching
// metric can't be a client-side re-sort the way RevenueRankingCard's toggle is — there's no
// single fetch that carries every metric's value per row. issuerName is the fund house's name
// (e.g. "元大投信"), NOT the company-name lookup other endpoints' `name` field gives — don't
// treat it as interchangeable. asOf's format depends on metric: "YYYY-MM" for most, "YYYY" for
// expenseRatio (latest full year only). Doesn't exclude leveraged/inverse ETFs.
export type EtfRankingMetric =
  | 'aum'
  | 'holders'
  | 'netFlow'
  | 'dcaAmount'
  | 'return3m'
  | 'return6m'
  | 'return1y'
  | 'return2y'
  | 'return3y'
  | 'return5y'
  | 'returnYtd'
  | 'return10y'
  | 'expenseRatio'

export interface EtfRankingRow {
  rank: number
  symbol: string
  fundName: string
  shortName: string
  issuerName: string
  category: string
  value: string
  asOf: string
  // Added 2026-09-02: split out of `category` (which is unchanged, still the raw combined
  // string) — market is straightforward, assetClass is null for actively-managed ETFs (see
  // isActive), otherwise one of a closed set bff-ts enumerated.
  market: 'TWSE' | 'TPEx'
  assetClass: '國內成分證券' | '國外成分證券' | '債券成分' | '槓桿型' | '反向型' | '多資產' | '連結式' | null
  isActive: boolean
}

export interface EtfRanking {
  metric: EtfRankingMetric
  order: 'asc' | 'desc'
  limit: number
  rankings: EtfRankingRow[]
  warnings: string[]
}

function fallback(metric: EtfRankingMetric, order: 'asc' | 'desc', limit: number): EtfRanking {
  return { metric, order, limit, rankings: [], warnings: ['offline fallback'] }
}

// Per user request 2026-09-02 ("dashboard請儲存在前端，因為資料頻率是日更，沒必要重複抓取"):
// each metric is fetched at most once per session and cached client-side (useState, keyed by
// metric) — switching back to a metric already viewed this session reuses the cached response
// instead of refetching. useAsyncData covers the FIRST metric (SSR-friendly, no blank flash on
// initial load); subsequent metric switches bypass useAsyncData's own `watch` option entirely
// and write straight into its returned `data` ref instead — useAsyncData's watch-triggered
// re-invocation was observed re-running with a stale `metric.value` in dev (root cause not
// fully understood; this sidesteps it rather than depending on it).
export function useEtfRanking(metric: Ref<EtfRankingMetric>, order: 'asc' | 'desc' = 'desc', limit = 20) {
  const config = useRuntimeConfig()
  const cache = useState<Partial<Record<EtfRankingMetric, EtfRanking>>>('etf-ranking-cache', () => ({}))

  async function fetchMetric(targetMetric: EtfRankingMetric): Promise<EtfRanking> {
    try {
      return await $fetch<EtfRanking>('/market/etf-ranking', {
        baseURL: config.public.apiBase,
        query: { metric: targetMetric, order, limit }
      })
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(
          `[etf-ranking] GET ${config.public.apiBase}/market/etf-ranking unavailable (${reason}), using fallback instead`
        )
      }
      return fallback(targetMetric, order, limit)
    }
  }

  const asyncData = useAsyncData<EtfRanking>('etf-ranking', async () => {
    const targetMetric = metric.value
    if (cache.value[targetMetric]) return cache.value[targetMetric]!
    const result = await fetchMetric(targetMetric)
    cache.value[targetMetric] = result
    return result
  // lazy + server:false — same reasoning as every dashboard composable (see dashboard.vue's
  // own comment): bff-ts's endpoint latency varies a lot in practice, and without server:false
  // the whole etf-zone page's SSR response waits for the fetch before rendering anything
  // (lazy alone doesn't skip that).
  }, { default: () => fallback(metric.value, order, limit), lazy: true, server: false })

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
