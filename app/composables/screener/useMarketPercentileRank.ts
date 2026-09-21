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

// `excludeZero` adds a SECOND filter — `{ field, min: 0, max: 0, exclude: true }` — alongside the
// bracketing one; POST /screener already ANDs multiple filters together (the same semantics the
// real screener page's own condition pills use), so this needs no new bff-ts capability. Per
// analysis-ts's own confirmation 2026-09-20 (in response to their earlier company-rank excludeZero
// addition, which is unrelated to this endpoint): "POST /screener 的 filter 語意本來就支援排除精確
// 等於 0：{ min: 0, max: 0, exclude: true }...null 本來就一律排除".
async function countWhere(apiBase: string, field: string, min: number | null, max: number | null, excludeZero: boolean): Promise<number> {
  const filters = [{ field, min, max, exclude: false }]
  if (excludeZero) filters.push({ field, min: 0, max: 0, exclude: true })
  const response = await $fetch<{ count: number }>('/screener', {
    baseURL: apiBase,
    method: 'POST',
    body: { filters, page: 1, pageSize: 1 }
  })
  return response.count
}

// `field` fixed per call site (not reactive) — every current adopter (dividend.vue's own
// 現金殖利率 gauge) wants exactly one metric's rank for the page's own already-known stock value,
// not a togglable field the way useValuationRanking.ts's own dashboard card is. `currentValue`
// stays a Ref since it depends on an async stock-summary fetch that may still be pending when
// this composable is first called.
//
// `excludeZero` (2026-09-20) — dividend.vue's own 現金殖利率 gauge passes true so a company is
// ranked against payers only, not diluted by the ~16% of the market that pays no dividend at all
// (same reasoning as this file's own useMarketYieldDistribution's own excludeZero, and
// server/utils/stock-data.ts's own company-rank one — three independent places converging on the
// same fix the same day). Defaults false since a future non-殖利率 adopter of this composable
// would have no reason to assume 0 is a meaningless value for its own field.
export function useMarketPercentileRank(field: string, currentValue: Ref<number | null>, excludeZero = false) {
  const config = useRuntimeConfig()

  return useAsyncData<MarketPercentileRank | null>(
    `market-percentile-rank-${field}-${excludeZero}`,
    async () => {
      const value = currentValue.value
      if (value === null) return null
      const [total, countAtOrBelow] = await Promise.all([
        countWhere(config.public.apiBase, field, null, null, excludeZero),
        countWhere(config.public.apiBase, field, null, value, excludeZero)
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
// 看到各個區間與公司數量的分布圖"), 同日後續要求改用真正的伺服端端點 ("如果改成分布圖呢? 就是
// 中間有波峰的那種圖，請跟analysis提需求"). First shipped as a client-side bracketing hack (9 fixed
// cut points against POST /screener's own `count`, differenced) — replaced the same day once
// analysis-ts shipped a real GET /screener/distribution endpoint (Postgres `width_bucket()`,
// computed server-side in one request instead of ~9-30 client round trips). That old bracketing
// version's own comment (bin edges, differencing logic) is gone — this is a straight passthrough
// of the new endpoint's own response shape now, no client-side binning math left to document.
//
// clippedMin/clippedMax (1st/99th percentile) vs trueMin/trueMax (真實極值，未裁切) — per
// analysis-ts's own explanation: without clipping, a single extreme outlier (現金殖利率 market-wide
// runs up to 19.6%) would stretch the bin width so far that every other bar collapses into one
// visible column. Outliers aren't dropped — they fall into the leftmost/rightmost bin, and
// `bins[].count` sums to exactly `totalCount` — this composable just passes both pairs through so
// the caller can caption "資料範圍" honestly instead of silently pretending the axis IS the full
// range.
export interface MarketDistributionBin {
  label: string
  midpoint: number
  count: number
}

export interface MarketDistribution {
  bins: MarketDistributionBin[]
  totalCount: number
  trueMin: number
  trueMax: number
  clippedMin: number
  clippedMax: number
}

interface DistributionApiBin { min: number; max: number; count: number }
interface DistributionApiResponse {
  field: string
  totalCount: number
  trueMin: number
  trueMax: number
  clippedMin: number
  clippedMax: number
  bins: DistributionApiBin[]
}

// `enabled` — same "don't fire until the caller actually has a reason to expand this" gating as
// StockValuationRiverChart.vue's own chart-behind-a-toggle cards use elsewhere. `bins` defaults to
// 25 — inside analysis-ts's own recommended 20～30 (their own reply: "應該就夠平滑了，不需要到
// 50"), one request either way so the exact count is cheap to tune per caller if it ever needs to.
//
// `excludeZero` — added 2026-09-18 after the user asked us to explore a bell-shaped/centered
// version of this chart ("跟 analysis 討論做出 鐘型 圖表"). analysis-ts's own reply after looking
// into it: a log-scale x-axis (the other option we floated) would misrepresent 殖利率 as a
// multiplicative-scale quantity it isn't, purely to force a symmetric look — the same "don't
// visually massage the shape" problem as cropping the axis, just dressed up as a transform. What
// they DID ship: `excludeZero=true` filters out the ~16% of the market that pays no dividend at
// all before binning, so the caller can show "what does the distribution look like among
// companies that actually pay a dividend" as a genuinely different, still-honest question — NOT a
// bell curve, just a less extreme right skew once the zero-pile is out. Deliberately `<> 0` not
// `> 0` on their end (per their own note) so this same endpoint stays usable for signed fields
// later without silently dropping negative values too — irrelevant to this caller today, but
// documented here since it explains why the param is spelled `excludeZero` and not `positiveOnly`.
export function useMarketYieldDistribution(field: string, enabled: Ref<boolean>, excludeZero: Ref<boolean>, bins = 25) {
  const config = useRuntimeConfig()

  // Plain refs + a manual load(), not useAsyncData — a real, reproduced bug: useAsyncData's own
  // key is `market-distribution-${field}-${bins}` (deliberately NOT including `excludeZero`, so
  // toggling it should reuse the same cache slot instead of creating a second one), but a SECOND
  // `execute()` call — triggered correctly, with a debug watcher confirming `excludeZero.value`
  // already read `true` at the moment it fired — still ran the handler with `excludeZero.value`
  // reading back `false` INSIDE that same handler closure moments later (a call-count probe
  // confirmed it really was the same closure invoked twice, not a duplicate registration
  // somewhere else). Root cause not fully pinned down (suspected Suspense double-setup
  // interaction with useAsyncData's own global key registry, in the same "Vue-internal timing
  // surprise" family as StockDetailSidebarNav.vue's own Teleport bug), but passing the watcher's
  // OWN already-correct value as a plain function argument instead of re-reading `excludeZero.value`
  // ambiently inside a framework-orchestrated re-invocation sidesteps it entirely — no shared key,
  // no re-entrant handler, just an ordinary async call with an explicit parameter.
  const data = ref<MarketDistribution | null>(null)
  const pending = ref(false)

  async function load(shouldExcludeZero: boolean) {
    pending.value = true
    try {
      const response = await $fetch<DistributionApiResponse>('/screener/distribution', {
        baseURL: config.public.apiBase,
        method: 'GET',
        params: { field, bins, excludeZero: shouldExcludeZero || undefined }
      })
      data.value = {
        totalCount: response.totalCount,
        trueMin: response.trueMin,
        trueMax: response.trueMax,
        clippedMin: response.clippedMin,
        clippedMax: response.clippedMax,
        bins: response.bins.map(bin => ({
          label: `${bin.min.toFixed(1)}～${bin.max.toFixed(1)}%`,
          midpoint: (bin.min + bin.max) / 2,
          count: bin.count
        }))
      }
    } finally {
      pending.value = false
    }
  }

  // Refetches whenever `excludeZero` flips WHILE expanded too (not just on first expand) — the
  // response genuinely differs, unlike a plain expand/collapse which should reuse cached data. The
  // `lastExcludeZero` guard skips a redundant refetch on a bare collapse→expand cycle where
  // nothing about the query actually changed.
  let lastExcludeZero: boolean | null = null
  watch(
    [enabled, excludeZero],
    ([isEnabled, isExcludeZero]) => {
      if (!isEnabled || pending.value) return
      if (data.value !== null && lastExcludeZero === isExcludeZero) return
      lastExcludeZero = isExcludeZero
      load(isExcludeZero)
    },
    { immediate: true }
  )

  return { data, pending }
}
