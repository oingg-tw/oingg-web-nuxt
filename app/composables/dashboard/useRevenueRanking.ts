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

const FALLBACK: RevenueRanking = { yearMonth: '', metric: 'revenue', order: 'desc', limit: 20, rankings: [], warnings: ['offline fallback'] }

// Revenue data only updates once a day (monthly filings, really), so this fetches once — by
// 'revenue' order — rather than refetching per metric like screener sorts do. The card's own
// metric toggle just re-sorts these same already-fetched rows client-side (each row already
// carries all three metric fields), trading "not quite the true top-20 for mom/yoy" for
// avoiding a repeat API call every time someone clicks the toggle.
export function useRevenueRanking(limit = 20) {
  const config = useRuntimeConfig()

  return useAsyncData<RevenueRanking>(
    'revenue-ranking',
    async () => {
      try {
        return await $fetch<RevenueRanking>('/market/revenue-ranking', {
          baseURL: config.public.apiBase,
          query: { metric: 'revenue', order: 'desc', limit }
        })
      } catch (error) {
        if (import.meta.dev) {
          const reason = error instanceof Error ? error.message : String(error)
          console.warn(
            `[revenue-ranking] GET ${config.public.apiBase}/market/revenue-ranking unavailable (${reason}), using fallback instead`
          )
        }
        return { ...FALLBACK, limit }
      }
    },
    // lazy + server:false — see dashboard.vue's own comment on why every dashboard composable
    // does this (one slow endpoint shouldn't block the whole page's SSR response; lazy alone
    // doesn't skip that — server:false is what actually keeps the fetch off the SSR path).
    { default: () => ({ ...FALLBACK, limit }), lazy: true, server: false }
  )
}
