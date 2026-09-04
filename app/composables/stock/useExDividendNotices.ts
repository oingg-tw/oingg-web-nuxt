export type ExDividendType = '息' | '權' | '權息'

// Confirmed by bff-ts/analysis-ts 2026-09-04: all 8 numeric fields are plain `number | null` —
// NOT bigint-serialized strings like useCapitalStockHistory.ts's paidInShares/paidInCapital
// turned out to be. This endpoint is simpler in that respect.
//
// Under exType='權', two groups are mutually exclusive (never both set on the same entry):
// - Stock dividend: stockDividendRatio alone.
// - Cash capital increase subscription: subscriptionRatio/subscriptionPricePerShare/
//   sharesOffered/sharesEmpOwner/sharesholderOwner/stockHoldingRatio together.
// exType='息' only ever sets cashDividend; everything else is null.
//
// The four subscription-group field NAMES (sharesOffered/sharesEmpOwner/sharesholderOwner/
// stockHoldingRatio) are analysis-ts's own best-guess translation of twse-ts's raw columns,
// NOT confirmed against twse-ts directly (flagged by bff-ts 2026-09-04) — treat their exact
// meaning as unconfirmed. Don't write confident Chinese copy claiming to know precisely what
// each one represents; show them plainly (raw label + value) until that's verified, same
// caution as this app already applies to any field whose real-world meaning isn't nailed down.
export interface ExDividendNotice {
  exDate: string
  exType: ExDividendType
  stockDividendRatio: number | null
  subscriptionRatio: number | null
  subscriptionPricePerShare: number | null
  cashDividend: number | null
  sharesOffered: number | null
  sharesEmpOwner: number | null
  sharesholderOwner: number | null
  stockHoldingRatio: number | null
}

// GET /stocks/ex-dividend-notices?symbols=<comma-separated, up to 100> — bff-ts forwarding onto
// analysis-ts, confirmed live 2026-09-04 (real data tested against 6533/1466). Covers both the
// single-symbol case (stock detail page) and the multi-symbol case (dashboard's watchlist
// card) with the same endpoint.
//
// Only ever returns FUTURE events — analysis-ts's own filter, not something re-checked here.
// A symbol with nothing upcoming is simply ABSENT from the response's `notices` map, not an
// empty array — this passes that through as-is rather than normalizing missing keys to `[]`,
// so callers can't accidentally treat "no key" and "empty array" as different states when the
// real API never distinguishes them.
//
// Returns null on a failed request vs. a real (possibly empty) object on a genuine response —
// same reasoning as useCapitalStockHistory.ts: a caller needs to tell "endpoint unreachable,
// show the structural shell" apart from "answered: nothing scheduled for this stock right now."
export function useExDividendNotices(symbols: Ref<string[]>) {
  const config = useRuntimeConfig()

  return useAsyncData<Record<string, ExDividendNotice[]> | null>(
    () => `ex-dividend-notices-${symbols.value.join(',') || 'none'}`,
    async () => {
      if (!symbols.value.length) return {}

      try {
        const raw = await $fetch<{ notices: Record<string, ExDividendNotice[]> }>('/stocks/ex-dividend-notices', {
          baseURL: config.public.apiBase,
          query: { symbols: symbols.value.join(',') }
        })
        return raw.notices
      } catch (error) {
        if (import.meta.dev) {
          const reason = error instanceof Error ? error.message : String(error)
          console.warn(`[ex-dividend-notices] GET ${config.public.apiBase}/stocks/ex-dividend-notices?symbols=${symbols.value.join(',')} unavailable (${reason})`)
        }
        return null
      }
    },
    { watch: [symbols], default: () => null }
  )
}
