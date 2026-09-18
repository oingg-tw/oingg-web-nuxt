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

// 全市場分布直方圖 — added 2026-09-18 per direct request ("我希望現金殖利率的市場排名，打開圖表會
// 看到各個區間與公司數量的分布圖"). Same bracketing trick as the percentile rank above, just
// applied at several cut points instead of one: `cum(x) = countWhere(field, null, x)` is "how many
// stocks have a value ≤ x" (identical meaning to `countAtOrBelow` above), so each bin's own count
// is a plain difference of two adjacent cumulative counts — `cum(edges[i]) − cum(edges[i-1])` —
// with NO separate per-bin min/max query needed (that would double-query the boundary values or,
// worse, leave a gap between bins if the upper/lower edges of adjacent bins aren't exact
// complements of each other, e.g. a bin ending "3" and the next starting "3.01" would silently
// drop every stock at exactly 3.00). Differencing a single cumulative sequence avoids that
// entirely by construction — every stock falls in exactly one bin, no double count, no gap.
export interface DistributionBin {
  label: string
  count: number
}

// Fixed, non-uniform bin edges for 現金殖利率（%）— NOT evenly spaced across the full 0～20%
// range that the market's own long right tail would otherwise imply (see
// StockDividendYieldPercentileCard.vue's own comment on the market being heavily right-skewed):
// evenly-spaced bins would cram the vast majority of stocks (clustered 2～6%) into one or two
// visible bars and leave most of the chart's width covering a handful of high-yield outliers.
// These edges narrow where the real mass of the market sits and widen only past 6%, so the shape
// of the bars reflects the shape of the distribution instead of the shape of the axis.
const DIVIDEND_YIELD_BIN_EDGES = [1, 2, 3, 4, 5, 6, 8, 10]

function dividendYieldBinLabel(index: number): string {
  if (index === 0) return `0～${DIVIDEND_YIELD_BIN_EDGES[0]}%`
  if (index === DIVIDEND_YIELD_BIN_EDGES.length) return `${DIVIDEND_YIELD_BIN_EDGES[DIVIDEND_YIELD_BIN_EDGES.length - 1]}%以上`
  return `${DIVIDEND_YIELD_BIN_EDGES[index - 1]}～${DIVIDEND_YIELD_BIN_EDGES[index]}%`
}

// `enabled` — same "don't fire until the caller actually has a reason to expand this" gating as
// StockValuationRiverChart.vue's own chart-behind-a-toggle cards use elsewhere, except here it
// also gates the FETCH itself (not just the render): 9 sequential-looking-but-parallel COUNT
// queries is meaningfully more backend load than the single percentile-rank pair above, so this
// stays idle until the card is actually expanded rather than firing on every page load.
export function useMarketYieldDistribution(field: string, enabled: Ref<boolean>) {
  const config = useRuntimeConfig()

  // `immediate: false` + a manual watcher instead of useAsyncData's own `watch` option — the
  // `watch` option's refresh fired on the same flush as `enabled` flipping true but read the
  // handler closure's `enabled.value` as still false (a real, reproduced timing quirk, confirmed
  // live via a separate `flush: 'sync'` watcher showing the ref itself already true at that
  // point), so the fetch silently never ran. Triggering `execute()` from an ordinary watcher here
  // instead is the same "don't fetch until expanded" gating without depending on that internal
  // timing.
  const asyncData = useAsyncData<DistributionBin[] | null>(
    `market-yield-distribution-${field}`,
    async () => {
      const cumulative = await Promise.all(DIVIDEND_YIELD_BIN_EDGES.map(edge => countWhere(config.public.apiBase, field, null, edge)))
      const total = await countWhere(config.public.apiBase, field, null, null)
      const boundaries = [0, ...cumulative, total]
      return DIVIDEND_YIELD_BIN_EDGES.map((_, index) => ({
        label: dividendYieldBinLabel(index),
        count: boundaries[index + 1]! - boundaries[index]!
      })).concat([{ label: dividendYieldBinLabel(DIVIDEND_YIELD_BIN_EDGES.length), count: total - cumulative[cumulative.length - 1]! }])
    },
    { default: () => null, immediate: false, server: false }
  )

  watch(
    enabled,
    (value) => {
      if (value && !asyncData.data.value && !asyncData.pending.value) asyncData.execute()
    },
    { immediate: true }
  )

  return asyncData
}
