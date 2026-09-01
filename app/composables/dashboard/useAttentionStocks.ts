// Confirmed live with bff-ts 2026-09-01: GET /market/attention-stocks?limit=20 — 注意股清單,
// newest trading date first, TWSE+TPEx merged. Not one of the three endpoints with nullable
// TPEx-only fields — every field here is populated regardless of market.
export interface AttentionStockRow {
  symbol: string
  name: string | null
  market: 'TWSE' | 'TPEx'
  tradeDate: string
  criteria: string
}

export interface AttentionStocksResponse {
  limit: number
  items: AttentionStockRow[]
  warnings: string[]
}

const FALLBACK: AttentionStocksResponse = { limit: 20, items: [], warnings: ['offline fallback'] }

export function useAttentionStocks(limit = 20) {
  const config = useRuntimeConfig()

  return useAsyncData<AttentionStocksResponse>(
    `attention-stocks-${limit}`,
    async () => {
      try {
        return await $fetch<AttentionStocksResponse>('/market/attention-stocks', {
          baseURL: config.public.apiBase,
          query: { limit }
        })
      } catch (error) {
        if (import.meta.dev) {
          const reason = error instanceof Error ? error.message : String(error)
          console.warn(
            `[attention-stocks] GET ${config.public.apiBase}/market/attention-stocks unavailable (${reason}), using fallback instead`
          )
        }
        return FALLBACK
      }
    },
    { default: () => FALLBACK }
  )
}
