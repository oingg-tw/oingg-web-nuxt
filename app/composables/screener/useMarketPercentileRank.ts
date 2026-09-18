// 全市場百分位排名 (PR值) — added 2026-09-18 per direct request ("配股配息 加上一張 量表 看出
// 個股的 現金殖利率，在全部市場PR多少"). Unlike percentile.ts's own computeGaugeStats (which
// needs the FULL array of values to sort and rank client-side, fine for a single stock's own
// ~5-year history window), a true cross-sectional rank across all ~1,583 listed stocks has no
// endpoint that returns every symbol's value at once — GET /screener/ranking caps `limit` at 50
// (confirmed live via curl), so bulk-fetching the whole market to sort client-side isn't an
// option.
//
// Confirmed live via curl instead: POST /screener's own `count` (the total-matches count, used
// everywhere else in this app just for pagination) can be repurposed as a bracketing tool by
// varying the filter's own min/max — `{ min: null, max: null }` on a field with NO OTHER filters
// returns the true total population size, and `{ min: null, max: X }` returns how many stocks are
// at or below X. `percentileRank = countAtOrBelowX / total * 100` needs exactly those two
// lightweight COUNT-only queries (`pageSize: 1`, ignoring `results` entirely) — no bulk data
// transfer, same POST /screener endpoint the real screener page already depends on.
export interface MarketPercentileRank {
  percentile: number
  total: number
}

async function countWhere(apiBase: string, field: string, min: number | null, max: number | null): Promise<number> {
  const response = await $fetch<{ count: number }>('/screener', {
    baseURL: apiBase,
    method: 'POST',
    body: { filters: [{ field, min, max, exclude: false }], page: 1, pageSize: 1 }
  })
  return response.count
}

// `field` fixed per call site (not reactive) — every current adopter (dividend.vue's own
// 現金殖利率 gauge) wants exactly one metric's rank for the page's own already-known stock value,
// not a togglable field the way useValuationRanking.ts's own dashboard card is. `currentValue`
// stays a Ref since it depends on an async stock-summary fetch that may still be pending when
// this composable is first called.
export function useMarketPercentileRank(field: string, currentValue: Ref<number | null>) {
  const config = useRuntimeConfig()

  return useAsyncData<MarketPercentileRank | null>(
    `market-percentile-rank-${field}`,
    async () => {
      const value = currentValue.value
      if (value === null) return null
      const [total, countAtOrBelow] = await Promise.all([
        countWhere(config.public.apiBase, field, null, null),
        countWhere(config.public.apiBase, field, null, value)
      ])
      if (total === 0) return null
      return { percentile: (countAtOrBelow / total) * 100, total }
    },
    // lazy + server:false — same reasoning every other dashboard/screener composable in this app
    // gives (see useValuationRanking.ts's own comment): this is a supplementary gauge fact, not
    // core page content, so it shouldn't block SSR or the page's own primary data.
    { default: () => null, lazy: true, server: false, watch: [currentValue] }
  )
}
