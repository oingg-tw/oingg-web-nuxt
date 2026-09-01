// Confirmed live with bff-ts 2026-09-01: GET /market/price-limit-range — 漲跌停幅度最大/最小
// 各20檔, no params, TWSE+TPEx merged. TPEx rows lack openingRefPrice/previousDayPrice/
// allowOddLotTrade (null, not a query failure).
export interface PriceLimitRangeRow {
  rank: number
  symbol: string
  name: string | null
  market: 'TWSE' | 'TPEx'
  limitUp: string
  limitDown: string
  limitRange: string
  openingRefPrice: string | null
  previousDayPrice: string | null
  allowOddLotTrade: string | null
}

export interface PriceLimitRange {
  tradeDate: string
  widest: PriceLimitRangeRow[]
  narrowest: PriceLimitRangeRow[]
}

const FALLBACK: PriceLimitRange = { tradeDate: '', widest: [], narrowest: [] }

export function usePriceLimitRange() {
  const config = useRuntimeConfig()

  return useAsyncData<PriceLimitRange>(
    'price-limit-range',
    async () => {
      try {
        return await $fetch<PriceLimitRange>('/market/price-limit-range', { baseURL: config.public.apiBase })
      } catch (error) {
        if (import.meta.dev) {
          const reason = error instanceof Error ? error.message : String(error)
          console.warn(
            `[price-limit-range] GET ${config.public.apiBase}/market/price-limit-range unavailable (${reason}), using fallback instead`
          )
        }
        return FALLBACK
      }
    },
    { default: () => FALLBACK }
  )
}
