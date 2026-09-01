// Confirmed live with bff-ts 2026-09-01: GET /market/foreign-holding-ranking?limit=10 —
// 外資持股加碼/減碼排行, sorted by percentage-point change (not share count). No auth,
// ETFs/derivatives excluded on their side already. Every ranking value comes back as a
// string, same convention as the screener's own /screener response.
//
// Breaking change from bff-ts, same day: topPercent (1-50, "top N% of eligible companies")
// replaced by limit (1-20, a fixed row count, default still 10) — analysis-ts only mirrors
// ~20 companies for foreign_holding right now, so a percentage cut of that tiny a pool
// wasn't meaningful (10% left just 2 rows), and a fixed count also now matches the sibling
// margin-short-ratio-ranking endpoint, which already used limit.
export interface ForeignHoldingRankingRow {
  symbol: string
  // Confirmed live 2026-09-01 alongside the limit migration — null when the symbol isn't in
  // bff-ts's company-name cache, same as everywhere else in this app that shows a name
  // alongside a bare symbol.
  name: string | null
  sharesHeldPercent: string
  previousSharesHeldPercent: string
  changePercentagePoints: string
  sharesHeld: string
}

export interface ForeignHoldingRanking {
  // Both null while bff-ts's own backfill hasn't accumulated two comparable trading days yet
  // (confirmed live 2026-09-01: increases/decreases come back as empty arrays in that state,
  // with `warnings` explaining why) — a real "no data yet" state, not an error, so callers
  // should render it as such rather than treating an empty ranking as broken.
  tradeDate: string | null
  previousTradeDate: string | null
  limit: number
  eligibleCompanyCount: number
  increases: ForeignHoldingRankingRow[]
  decreases: ForeignHoldingRankingRow[]
  warnings: string[]
}

const FALLBACK: ForeignHoldingRanking = {
  tradeDate: null,
  previousTradeDate: null,
  limit: 10,
  eligibleCompanyCount: 0,
  increases: [],
  decreases: [],
  warnings: ['offline fallback']
}

export function useForeignHoldingRanking(limit = 10) {
  const config = useRuntimeConfig()

  return useAsyncData<ForeignHoldingRanking>(
    `foreign-holding-ranking-${limit}`,
    async () => {
      try {
        return await $fetch<ForeignHoldingRanking>('/market/foreign-holding-ranking', {
          baseURL: config.public.apiBase,
          query: { limit }
        })
      } catch (error) {
        if (import.meta.dev) {
          const reason = error instanceof Error ? error.message : String(error)
          console.warn(
            `[foreign-holding-ranking] GET ${config.public.apiBase}/market/foreign-holding-ranking unavailable (${reason}), using fallback instead`
          )
        }
        return FALLBACK
      }
    },
    { default: () => FALLBACK }
  )
}
