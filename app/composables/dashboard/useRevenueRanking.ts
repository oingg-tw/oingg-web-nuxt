// Confirmed live with bff-ts 2026-09-01: GET /market/revenue-ranking — 月營收排行
// (yoy/mom/當月營收), TWSE+TPEx merged. metric and order are required params on their side.
// Every ranking value is a string, same convention as everywhere else.
//
// Narrowed to 'yoy' only 2026-09-13 (relayed live by analysis-ts) — mom/revenue sorting removed
// server-side: mom (月增率) swings too hard on seasonal noise to carry real stock-picking value,
// revenue (raw amount) just re-surfaces large-cap names with no growth signal. yoy is the one
// analysis-ts kept, with its own near-zero-base distortion guard. The response SHAPE didn't
// change (momChangePercent/currentMonthRevenue are still real fields on each row), only which
// `metric` query values the endpoint accepts — sorting by anything but yoy now 400s.
export type RevenueRankingMetric = 'yoy'

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

function fallback(limit: number): RevenueRanking {
  return { yearMonth: '', metric: 'yoy', order: 'desc', limit, rankings: [], warnings: ['offline fallback'] }
}

// No longer takes a `metric` param — the per-metric fetch+cache/switching machinery this used to
// need (see this file's own git history) only existed to support the now-removed mom/revenue
// options; with a single fixed metric there's nothing left to switch between.
export function useRevenueRanking(limit = 20) {
  const config = useRuntimeConfig()

  async function fetchRanking(): Promise<RevenueRanking> {
    try {
      return await $fetch<RevenueRanking>('/market/revenue-ranking', {
        baseURL: config.public.apiBase,
        query: { metric: 'yoy', order: 'desc', limit }
      })
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(
          `[revenue-ranking] GET ${config.public.apiBase}/market/revenue-ranking unavailable (${reason}), using fallback instead`
        )
      }
      return fallback(limit)
    }
  }

  // lazy + server:false — see dashboard.vue's own comment on why every dashboard composable does
  // this (one slow endpoint shouldn't block the whole page's SSR response; lazy alone doesn't
  // skip that — server:false is what actually keeps the fetch off the SSR path).
  return useAsyncData<RevenueRanking>('revenue-ranking', fetchRanking, { default: () => fallback(limit), lazy: true, server: false })
}
