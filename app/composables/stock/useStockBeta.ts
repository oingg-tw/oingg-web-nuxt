export interface StockBetaWindow {
  // '3Y_1W' added 2026-09-16 (analysis-ts shipped a 4th window, bff-ts commit 18424d0) — confirmed
  // live against GET /stocks/2330/beta before adding this, not guessed from the changelog alone.
  timeframe: '1Y_1D' | '2Y_1W' | '3Y_1W' | '5Y_1M'
  value: number | null
  nullReason: string | null
  tradeDate: string
  knowledgeDate: string
  knowledgeDateIsFallback: boolean
}

export interface StockBeta {
  symbol: string
  windows: StockBetaWindow[]
}

// bff-ts's GET /stocks/:symbol/beta (confirmed live 2026-09-14, pure passthrough of analysis-ts's
// own new GET /companies/beta) — now 4 entries (3Y_1W added 2026-09-16, see StockBetaWindow's own
// comment) in 1Y_1D/2Y_1W/3Y_1W/5Y_1M order, `value` stays a real number (not string-serialized,
// matching roe-history/roa-history's own convention for this domain, unlike e.g.
// useStockSummary.ts's price/valuation fields). No symbol/no data still comes back 200 with all
// windows null, never a 404 — confirmed live against both a real and a made-up symbol.
export function useStockBeta(symbol: Ref<string | undefined>) {
  const config = useRuntimeConfig()

  return useAsyncData<StockBeta | null>(
    () => `stock-beta-${symbol.value ?? 'none'}`,
    async () => {
      const current = symbol.value
      if (!current) return null

      try {
        return await $fetch<StockBeta>(`/stocks/${current}/beta`, {
          baseURL: config.public.apiBase,
          retry: 0
        })
      } catch (error) {
        if (import.meta.dev) {
          const reason = error instanceof Error ? error.message : String(error)
          console.warn(`[stock-beta] GET ${config.public.apiBase}/stocks/${current}/beta unavailable (${reason})`)
        }
        return null
      }
    },
    { watch: [symbol] }
  )
}
