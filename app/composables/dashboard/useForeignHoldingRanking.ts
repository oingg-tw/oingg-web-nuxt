// Confirmed live with bff-ts 2026-09-01: GET /market/foreign-holding-ranking?topPercent=10 —
// 外資持股加碼/減碼排行, sorted by percentage-point change (not share count). topPercent is
// "top N% of eligible companies", not a fixed row count (default 10, range 1-50). No auth,
// ETFs/derivatives excluded on their side already. Every ranking value comes back as a
// string, same convention as the screener's own /screener response.
export interface ForeignHoldingRankingRow {
  symbol: string
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
  topPercent: number
  eligibleCompanyCount: number
  increases: ForeignHoldingRankingRow[]
  decreases: ForeignHoldingRankingRow[]
  warnings: string[]
}

const FALLBACK: ForeignHoldingRanking = {
  tradeDate: null,
  previousTradeDate: null,
  topPercent: 10,
  eligibleCompanyCount: 0,
  increases: [],
  decreases: [],
  warnings: ['offline fallback']
}

export function useForeignHoldingRanking(topPercent = 10) {
  const config = useRuntimeConfig()

  return useAsyncData<ForeignHoldingRanking>(
    `foreign-holding-ranking-${topPercent}`,
    async () => {
      try {
        return await $fetch<ForeignHoldingRanking>('/market/foreign-holding-ranking', {
          baseURL: config.public.apiBase,
          query: { topPercent }
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
