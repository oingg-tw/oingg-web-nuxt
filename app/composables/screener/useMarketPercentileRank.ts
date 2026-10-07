// 全市場殖利率分布（GET /screener/distribution）：配股配息頁的市場排名圖讀它。原本同檔還有一個用兩次
// POST /screener 的 count 夾出百分位的 useMarketPercentileRank（2026-09-18），2026-09-24 起排名改由伺服器
// 端算（PayerPercentile），2026-10-08 刪除。

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
  // Read from THIS response, never fetched separately: the field is EOD, so the cut points move
  // every day and bins stitched to quantiles from another request would disagree（analysis-ts's
  // own instruction）. They are computed in the same percentile_cont query that produces the
  // clip bounds, over the same filtered population, so they cannot drift from totalCount either.
  quantiles: { p20: number; p40: number; p60: number; p80: number } | null
}

interface DistributionApiBin { min: number; max: number; count: number }
// 五等分位的邊界值（2026-09-24, analysis-ts 8dad52df）. null as a whole when the population is
// empty — analysis-ts returns the four together or not at all, deliberately, so a caller can never
// label an axis from half a set.
interface DistributionApiQuantiles { p20: number; p40: number; p60: number; p80: number }
interface DistributionApiResponse {
  field: string
  totalCount: number
  trueMin: number
  trueMax: number
  clippedMin: number
  clippedMax: number
  bins: DistributionApiBin[]
  quantiles: DistributionApiQuantiles | null
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
  // 用普通 ref＋手動 load()，不用 useAsyncData——實際重現過的 bug：key 刻意不含 excludeZero（切換要共用同一個快取槽），但第二次
  // execute() 時 handler 閉包裡讀到的 excludeZero.value 是舊值（watcher 已確認是 true，呼叫次數探針確認是同一個閉包被叫兩次）。
  // 根因沒完全釘死（懷疑 Suspense 的雙重 setup 跟 useAsyncData 的全域 key 登記互動）；把 watcher 已經正確的值當參數傳進去、
  // 不在被框架重新呼叫的 handler 裡回頭讀 ref，就整個繞過。
  const data = ref<MarketDistribution | null>(null)
  const pending = ref(false)
  // 讀不到時交給全站的讀取失敗彈窗（AppLoadFailureDialog，2026-10-08）。原本錯誤直接往外丟（沒人接）、
  // 畫面只剩一句「市場分布資料暫時無法計算」，跟「真的沒有分布資料」同一句話。
  const error = ref<unknown>(null)
  watchLoadFailure(`market-distribution:${field}:${bins}`, () => error.value, () => load(excludeZero.value))

  async function load(shouldExcludeZero: boolean) {
    pending.value = true
    try {
      const response = await apiFetch<DistributionApiResponse>('/screener/distribution', {
        method: 'GET',
        params: { field, bins, excludeZero: shouldExcludeZero || undefined }
      })
      error.value = null
      data.value = {
        totalCount: response.totalCount,
        trueMin: response.trueMin,
        trueMax: response.trueMax,
        clippedMin: response.clippedMin,
        clippedMax: response.clippedMax,
        quantiles: response.quantiles ?? null,
        bins: response.bins.map(bin => ({
          label: `${bin.min.toFixed(1)}～${bin.max.toFixed(1)}%`,
          midpoint: (bin.min + bin.max) / 2,
          count: bin.count
        }))
      }
    } catch (caught) {
      error.value = caught
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
