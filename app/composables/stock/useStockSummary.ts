import type { Delisting, TradingHalt } from '~/utils/trading-halt'

// GET /stocks/{symbol} — 業務中台's real quote endpoint (confirmed live 2026-09-14 by reading
// oingg-bff-ts/src/domainBff/stock/stock.openapi.ts directly, after a reported "打2330出404" bug:
// this composable used to call a `/stocks/{symbol}/summary` path with a combined price/valuation/
// marketCap shape that was never real — invented while writing this composable rather than
// verified against 業務中台's own schema first, the exact mistake this app's own conventions say to
// avoid (see the ecosystem reference guide's "don't invent field/metric keys, ever"). The real
// endpoint has no `/summary` suffix, no marketCap section at all, and price only ever carries
// `close` — no volume, no change amount/percent (stock/[code].vue derives those for real from
// useDailyPriceHistory's last two entries instead of assuming this endpoint has them). 業務中台's
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
  // 停止買賣與下市（2026-10-22 請 業務中台／analysis-ts 在這支帶出，形狀同 GET /stocks 每一列）；沒有是 null
  tradingHalt: TradingHalt | null
  delisting: Delisting | null
}

interface RawStockQuote {
  symbol: string
  price: { tradeDate: string; close: string | null } | null
  // liveCashDividendYield：analysis-ts 的 quote 加、業務中台照轉（2026-10-25 提出）
  valuation: { tradeDate: string; peRatio: string | null; pbRatio: string | null; liveCashDividendYield?: string | null } | null
  tradingHalt?: TradingHalt | null
  delisting?: Delisting | null
}

function toNumber(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

// Returns null on any failure (unreachable backend, 404 for a symbol with no quote data) rather
// than fabricating numbers — same "optimistic fetch, graceful empty" contract as every other
// per-symbol composable in this app. `price` resolves to null both when 業務中台's own price
// section is null AND when its `close` string fails to parse — either way there's no usable quote.
//
// Fetched through this app's own cached passthrough（/api/cached, server/api/cached/[...path].get.ts）
// since 2026-09-19: the same 業務中台 path and shape, but a warm render costs 業務中台 nothing and the
// browser never calls 業務中台 directly.
export function useStockSummary(symbol: Ref<string | undefined>) {
  return useAsyncData<StockSummary | null>(
    () => `stock-summary-${symbol.value ?? 'none'}`,
    async () => {
      const current = symbol.value
      if (!current) return null

      try {
        const raw = await apiFetch<RawStockQuote>(`/stocks/${current}`, { baseURL: BUSINESS_CACHED_BASE })
        const close = toNumber(raw.price?.close)
        return {
          symbol: raw.symbol,
          price: raw.price && close !== null ? { tradeDate: raw.price.tradeDate, close } : null,
          valuation: raw.valuation
            ? {
                tradeDate: raw.valuation.tradeDate,
                peRatio: toNumber(raw.valuation.peRatio),
                pbRatio: toNumber(raw.valuation.pbRatio),
                // 自算的現金殖利率（2026-10-25，同篩選、排行與配股配息頁的圖）。交易所的 dividendYield 不讀：股票股利按面額算進去，
                // 3040 會寫 11.78%、圖上卻是 0。上游還沒帶這一欄時是 null，殖利率那半句就不出現，不拿交易所值補
                dividendYield: toNumber(raw.valuation.liveCashDividendYield)
              }
            : null,
          tradingHalt: raw.tradingHalt ?? null,
          delisting: raw.delisting ?? null
        }
      } catch (error) {
        devWarn('stock-summary', `GET /api/cached/stocks/${current} unavailable`, error)
        return null
      }
    },
    { watch: [symbol] }
  )
}
