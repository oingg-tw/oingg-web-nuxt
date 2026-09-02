// Confirmed live with bff-ts 2026-09-01: GET /market/attention-stocks?limit=20 — 注意股清單,
// newest trading date first, TWSE+TPEx merged. Not one of the three endpoints with nullable
// TPEx-only fields — every field here is populated regardless of market.
//
// criteriaDetails added 2026-09-02: a structured parse of the `criteria` free-text string.
// An array (not a single object) because the raw text sometimes concatenates two reason
// clauses with no separator, in which case there are two entries. observationDays is only
// populated for the "N個營業日內已有M次" phrasing — null for "連續N次". Empty array when
// parsing fails; `criteria` itself is unaffected and still usable as a display fallback.
// Not consumed by AttentionStockCard.vue yet — the plain criteria text already renders fine
// there; this is here so the field is typed and available if a more structured display is
// wanted later.
export interface AttentionStockCriteriaDetail {
  startDate: string
  endDate: string
  observationDays: number | null
  times: number
}

export interface AttentionStockRow {
  symbol: string
  name: string | null
  market: 'TWSE' | 'TPEx'
  tradeDate: string
  criteria: string
  criteriaDetails: AttentionStockCriteriaDetail[]
  // Added 2026-09-02: 6-trading-day cumulative price change through tradeDate (point-to-point
  // vs. 6 sessions prior, not a sum of daily changes) — the actual price context behind why a
  // stock tripped the attention threshold (TWSE/TPEx's own rules include "近6日累積漲跌幅逾
  // 25%~32%"-type criteria). null when fewer than 6 trading days of history exist.
  sixDayChangePercent: string | null
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
