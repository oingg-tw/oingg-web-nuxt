// Confirmed live with bff-ts 2026-09-01: GET /market/margin-short-ratio-ranking?limit=20 —
// 券資比排行（融券餘額 ÷ 融資餘額 × 100，一個籌碼面軋空熱度指標，非日增減幅）, real data
// available now (confirmed range 1-100). No auth, ETFs/derivatives excluded on their side
// already. Every ranking value comes back as a string, same convention as the screener's own
// /screener response.
export interface MarginShortRatioRankingRow {
  rank: number
  symbol: string
  shortToMarginRatioPct: string
  marginTodayBalance: string
  shortTodayBalance: string
}

export interface MarginShortRatioRanking {
  tradeDate: string | null
  limit: number
  rankings: MarginShortRatioRankingRow[]
  warnings: string[]
}

const FALLBACK: MarginShortRatioRanking = {
  tradeDate: null,
  limit: 20,
  rankings: [],
  warnings: ['offline fallback']
}

export function useMarginShortRatioRanking(limit = 20) {
  const config = useRuntimeConfig()

  return useAsyncData<MarginShortRatioRanking>(
    `margin-short-ratio-ranking-${limit}`,
    async () => {
      try {
        return await $fetch<MarginShortRatioRanking>('/market/margin-short-ratio-ranking', {
          baseURL: config.public.apiBase,
          query: { limit }
        })
      } catch (error) {
        if (import.meta.dev) {
          const reason = error instanceof Error ? error.message : String(error)
          console.warn(
            `[margin-short-ratio-ranking] GET ${config.public.apiBase}/market/margin-short-ratio-ranking unavailable (${reason}), using fallback instead`
          )
        }
        return FALLBACK
      }
    },
    { default: () => FALLBACK }
  )
}
