// GET /stocks/{symbol} — bff-ts's real quote endpoint (confirmed live 2026-09-14 by reading
// oingg-bff-ts/src/domainBff/stock/stock.openapi.ts directly, after a reported "打2330出404" bug:
// this composable used to call a `/stocks/{symbol}/summary` path with a combined price/valuation/
// marketCap shape that was never real — invented while writing this composable rather than
// verified against bff-ts's own schema first, the exact mistake this app's own conventions say to
// avoid (see the ecosystem reference guide's "don't invent field/metric keys, ever"). The real
// endpoint has no `/summary` suffix, no marketCap section at all, and price only ever carries
// `close` — no volume, no change amount/percent (stock/[code].vue derives those for real from
// useDailyPriceHistory's last two entries instead of assuming this endpoint has them). bff-ts's
// own numbers also come back as strings (its Zod schema: `z.string().nullable()`), not numbers —
// toNumber() below is the one place that conversion happens, so every caller gets real numbers.
export interface StockSummaryPrice {
  tradeDate: string
  close: number
}

export interface StockSummaryValuation {
  tradeDate: string
  peRatio: number | null
  pbRatio: number | null
  dividendYield: number | null
}

export interface StockSummary {
  symbol: string
  price: StockSummaryPrice | null
  valuation: StockSummaryValuation | null
}

interface RawStockQuote {
  symbol: string
  price: { tradeDate: string; close: string | null } | null
  valuation: { tradeDate: string; peRatio: string | null; pbRatio: string | null; dividendYield: string | null } | null
}

function toNumber(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

// Returns null on any failure (unreachable backend, 404 for a symbol with no quote data) rather
// than fabricating numbers — same "optimistic fetch, graceful empty" contract as every other
// per-symbol composable in this app. `price` resolves to null both when bff-ts's own price
// section is null AND when its `close` string fails to parse — either way there's no usable quote.
//
// Fetched through this app's own cached passthrough（/api/bff, server/api/bff/[...path].get.ts）
// since 2026-09-19: the same bff-ts path and shape, but a warm render costs bff-ts nothing and the
// browser never calls bff-ts directly.
export function useStockSummary(symbol: Ref<string | undefined>) {
  return useAsyncData<StockSummary | null>(
    () => `stock-summary-${symbol.value ?? 'none'}`,
    async () => {
      const current = symbol.value
      if (!current) return null

      try {
        const raw = await $fetch<RawStockQuote>(`/stocks/${current}`, {
          baseURL: '/api/bff',
          retry: 0
        })
        const close = toNumber(raw.price?.close)
        return {
          symbol: raw.symbol,
          price: raw.price && close !== null ? { tradeDate: raw.price.tradeDate, close } : null,
          valuation: raw.valuation
            ? {
                tradeDate: raw.valuation.tradeDate,
                peRatio: toNumber(raw.valuation.peRatio),
                pbRatio: toNumber(raw.valuation.pbRatio),
                dividendYield: toNumber(raw.valuation.dividendYield)
              }
            : null
        }
      } catch (error) {
        if (import.meta.dev) {
          const reason = error instanceof Error ? error.message : String(error)
          console.warn(`[stock-summary] GET /api/bff/stocks/${current} unavailable (${reason})`)
        }
        return null
      }
    },
    { watch: [symbol] }
  )
}
