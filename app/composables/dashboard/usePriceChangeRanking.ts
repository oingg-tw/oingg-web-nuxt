// Confirmed live with bff-ts 2026-09-02: GET /market/price-change-ranking?limit= — 漲跌幅排行,
// TWSE+TPEx merged, complete data unlike the twse-ts/tpex-ts export-dataset-dependent batch
// (not gated behind backfill). tradeDate/previousTradeDate are per-row, not a single shared
// top-level date — TWSE and TPEx can have different "latest two trading days" — so don't
// collapse this into one footer note the way other ranking cards do.
export interface PriceChangeRankingRow {
  rank: number
  symbol: string
  name: string | null
  market: 'TWSE' | 'TPEx'
  tradeDate: string
  previousTradeDate: string
  close: string
  previousClose: string
  changeAmount: string
  changePercent: string
}

export interface PriceChangeRanking {
  limit: number
  gainers: PriceChangeRankingRow[]
  losers: PriceChangeRankingRow[]
  warnings: string[]
}

const FALLBACK: PriceChangeRanking = { limit: 20, gainers: [], losers: [], warnings: ['offline fallback'] }

export function usePriceChangeRanking(limit = 20) {
  const config = useRuntimeConfig()

  return useAsyncData<PriceChangeRanking>(
    `price-change-ranking-${limit}`,
    async () => {
      try {
        return await $fetch<PriceChangeRanking>('/market/price-change-ranking', {
          baseURL: config.public.apiBase,
          query: { limit }
        })
      } catch (error) {
        if (import.meta.dev) {
          const reason = error instanceof Error ? error.message : String(error)
          console.warn(
            `[price-change-ranking] GET ${config.public.apiBase}/market/price-change-ranking unavailable (${reason}), using fallback instead`
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
