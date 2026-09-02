// Confirmed live with bff-ts 2026-09-01: GET /market/disposed-stocks?limit=20 — 處置股清單,
// newest announcement date first, TWSE+TPEx merged. TPEx rows lack announcementCount/
// dispositionMeasures/linkInformation (null, not a query failure).
export interface DisposedStockRow {
  symbol: string
  name: string | null
  market: 'TWSE' | 'TPEx'
  announceDate: string
  announcementCount: number | null
  reason: string
  dispositionPeriod: string
  dispositionMeasures: string | null
  detail: string
  linkInformation: string | null
  // Added 2026-09-02: 6-trading-day cumulative price change through announceDate
  // (point-to-point vs. 6 sessions prior, not a sum of daily changes) — same field/semantics
  // as AttentionStockRow's sixDayChangePercent, see useAttentionStocks.ts's comment. null when
  // fewer than 6 trading days of history exist.
  sixDayChangePercent: string | null
  // Added 2026-09-02: the trigger count parsed out of `reason`'s free-text (e.g. "連續五次" →
  // 5, "連續3個營業日及沖銷標準" → 3) — a simpler cousin of AttentionStockRow's
  // criteriaDetails (only extracts the count, not dates, since dispositionPeriod's start~end
  // already covers that). null means "this reason has no count concept" (e.g. convertible-bond
  // underlying securities), not a parse failure.
  reasonTimes: number | null
}

export interface DisposedStocksResponse {
  limit: number
  items: DisposedStockRow[]
  warnings: string[]
}

const FALLBACK: DisposedStocksResponse = { limit: 20, items: [], warnings: ['offline fallback'] }

export function useDisposedStocks(limit = 20) {
  const config = useRuntimeConfig()

  return useAsyncData<DisposedStocksResponse>(
    `disposed-stocks-${limit}`,
    async () => {
      try {
        return await $fetch<DisposedStocksResponse>('/market/disposed-stocks', {
          baseURL: config.public.apiBase,
          query: { limit }
        })
      } catch (error) {
        if (import.meta.dev) {
          const reason = error instanceof Error ? error.message : String(error)
          console.warn(
            `[disposed-stocks] GET ${config.public.apiBase}/market/disposed-stocks unavailable (${reason}), using fallback instead`
          )
        }
        return FALLBACK
      }
    },
    { default: () => FALLBACK }
  )
}
