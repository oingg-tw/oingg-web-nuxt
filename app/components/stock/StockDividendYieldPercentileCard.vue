<script setup lang="ts">
import type { PayerPercentile } from '#shared/types/stock-context'
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, MarkLineComponent } from 'echarts/components'

use([SVGRenderer, LineChart, GridComponent, TooltipComponent, MarkLineComponent])

// 現金殖利率的市場排名 — added 2026-09-18 per direct request ("配股配息 加上一張 量表 看出 個股的
// 現金殖利率，在全部市場PR多少"). Reuses StockDividendStabilityCard.vue's own
// useDividendStabilitySnapshot for the current dividendYield.EOD value (same field, same fetch
// pattern, no second independent source of truth for "what's this stock's own 殖利率 right now")
// — this card's own new piece is useMarketPercentileRank.ts, which answers "where does that
// number sit against the whole market" (see that composable's own comment for how it computes a
// true cross-sectional percentile without bulk-fetching all ~1,583 listed stocks).
//
// showToggle=true + 分布圖 — 2026-09-18 direct follow-up ("我希望現金殖利率的市場排名，打開圖表會
// 看到各個區間與公司數量的分布圖"), then a same-day follow-up changed the shape ("如果改成分布圖
// 呢? 就是中間有波峰的那種圖，請跟analysis提需求"): originally a plain bar chart against 9
// client-bracketed bins, now a smooth line+area curve against analysis-ts's real
// GET /screener/distribution endpoint (see useMarketYieldDistribution.ts's own comment for that
// switch). A smooth line (not bars) over bin MIDPOINTS is what actually reads as "有波峰" — bars
// are discrete columns with no implied shape between them, a smoothed line across evenly-spaced
// midpoints is the standard density-curve rendering. `markLine` marks this stock's own 殖利率 on
// the x-axis — the same "you are here" convention as the gauge's own marker above it, ties the
// distribution shape back to the one number this card is actually about.
//
// 「為什麼中間不是波峰？」→「跟 analysis 討論做出鐘型圖表」— 2026-09-18 direct follow-up chain.
// The real shape (peaked near 0%, long right tail) isn't a bug — 殖利率 is bounded at 0 with no
// upper bound, so it's naturally right-skewed like most financial ratios, not normally
// distributed. Asked analysis-ts to look into 2 ways to get closer to a bell shape; their reply
// (see useMarketYieldDistribution.ts's own comment on `excludeZero`): a log-scale axis would
// misrepresent 殖利率 as a multiplicative quantity it isn't, purely to force symmetry — the same
// "don't visually massage the shape" problem as cropping the axis, just dressed up as a
// transform, so they declined server-side log-binning. What they DID ship and recommend instead:
// filtering out the ~16% of the market that pays no dividend at all before binning — a genuinely
// different, still-honest question ("what does the distribution look like among companies that
// actually pay a dividend"), not a fake bell curve.
//
// Was an opt-in `excludeZeroYield` toggle (el-switch, default off) so neither version was hidden —
// removed 2026-09-20 per direct decision relayed through analysis-ts ("跟使用者確認過了：那個
// el-switch...請拔掉，直方圖跟百分位一律固定用 excludeZero=true...不要保留切換「全部/僅配息」的選
// 項"), the same day the PERCENTILE bar above (useMarketPercentileRank's own excludeZero) already
// switched to always-on. Both halves of this card now describe the same fixed population — 有配息
// 公司 — with nothing left to toggle between.
//
// A `logScale` toggle was tried and removed same day ("我想看看Log座標效果如何" → "好吧，那就維持
// 原案。請幫我把多的控制項拿掉，簡化圖表"): re-plotting the SAME server-computed equal-WIDTH bins
// on a log x-axis, live-verified, still peaked at the left edge — the mass sits in one wide
// low-value bin regardless of axis scale, so the preview only confirmed the shape mismatch is a
// binning issue, not an axis one (a real log-histogram would need bins recomputed server-side from
// log(field), which analysis-ts declined to add). Not worth keeping as a permanent control once it
// had nothing left to show.

const props = defineProps<{
  symbol: string
  // Both counted on the SERVER and handed down（2026-09-24）— see PayerPercentile's own comment.
  // This card used to fetch them itself: POST /screener/values for the yield and two POST /screener
  // counts for the percentile, all `server: false`, so the page's headline visual was absent from
  // the server HTML entirely while the sentence above it was not.
  //
  // It also ended a live contradiction. The answer sentence read its rank from GET /screener/
  // company-rank and this card counted its own, and the two appeared on screen two centimetres
  // apart saying PR27 and PR13 about the same fact — company-rank ignores `excludeZero`, so its
  // 1,723-company population still contains the 278 that pay nothing. One source now feeds both.
  percentile: PayerPercentile | null
}>()

const dividendYield = computed<number | null>(() => props.percentile?.value ?? null)
const pending = computed(() => false)
const hasData = computed(() => props.percentile !== null)

// enabled=chartExpanded — the distribution fetch only fires once the card is actually expanded,
// not on every page load alongside the gauge's own single percentile-rank pair.
const chartExpanded = ref(false)
// Constant true (2026-09-20, no longer a togglable ref) — see this file's own top comment.
const excludeZeroYield = ref(true)
const { data: distribution, pending: distributionPending } = useMarketYieldDistribution('dividendYield.EOD', chartExpanded, excludeZeroYield)

const { resolvedMode, market } = useAppTheme()
const priceColors = computed(() => getPriceColors(resolvedMode.value, market.value))
const distributionInk = computed(() => getChartInk(resolvedMode.value))

interface DistributionTooltipParam { dataIndex?: number }

// The four cut points, read from the SAME response the bins came from — the field is EOD, so they
// move daily and a pair stitched from two requests would disagree（analysis-ts's own instruction）.
// `quantiles` is null as a whole on an empty population, which is a normal answer rather than an
// error（bff-ts 737a9be; it used to 502）, and analysis-ts never returns a partial set, so there is
// no half-labelled axis to guard against.
const quantileValues = computed(() => {
  const q = distribution.value?.quantiles
  return q ? [q.p20, q.p40, q.p60, q.p80] : []
})

// 軸的兩端錨點（2026-09-28「dividend 分布圖 最兩邊空白好多 看起來很怪」）。
//
// 量到的成因不是留白設定，是**標示全擠在左邊**：四個五等分位落在 1.29 / 2.62 / 4.10 / 5.84%，
// 而軸一路延伸到 12.47%——右邊 55% 的長度完全沒有刻度，讀起來像一段空白帶。那是右偏分佈加上
// 「只標五等分位」（2026-09-24 的指示）的必然結果，不是哪裡設錯。
//
// 修法是加兩個端點刻度而不是改回等距刻度：等距刻度那次被拿掉的理由仍然成立（在右偏分佈上，
// 「2% 4% 6%」說不出任一側有多少家公司）。端點不一樣——它說的是「資料到這裡為止」，那是讀者
// 判斷那條長尾有多長時唯一需要的資訊。同時把軸的上限收到最後一個資料點，軸就不再延伸到沒有
// 資料的地方。
const distributionEdges = computed(() => {
  const bins = distribution.value?.bins ?? []
  if (!bins.length) return null
  return { first: bins[0]!.midpoint, last: bins[bins.length - 1]!.midpoint }
})

const distributionOption = computed(() => {
  const bins = distribution.value?.bins ?? []
  const edges = distributionEdges.value
  return {
    textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
    grid: { left: 8, right: 16, top: 16, bottom: 48, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: distributionInk.value.baseline } },
      appendTo: 'body',
      backgroundColor: CHART_TOOLTIP.backgroundColor,
      borderColor: CHART_TOOLTIP.borderColor,
      textStyle: { color: CHART_TOOLTIP_INK.primary },
      formatter: (params: DistributionTooltipParam | DistributionTooltipParam[]) => {
        const list = Array.isArray(params) ? params : [params]
        const bin = bins[list[0]?.dataIndex ?? 0]
        if (!bin) return ''
        return `<div style="font-size: 1rem;"><div style="font-weight:600;margin-bottom:4px;">殖利率 ${bin.label}</div>${bin.count} 檔公司</div>`
      }
    },
    xAxis: {
      type: 'value',
      name: '殖利率',
      // 預設 name 放在軸的右端，會跟右端的錨點刻度相撞（實測只看得到「殖利」兩個字）。移到中央
      // 下方，grid.bottom 一併加高讓出那一行。
      nameLocation: 'middle',
      nameGap: 32,
      nameTextStyle: { color: distributionInk.value.muted, fontSize: 16 },
      axisLine: { lineStyle: { color: distributionInk.value.baseline } },
      axisTick: { show: false },
      // The default vertical gridlines are drawn at the axis's own even intervals, which no longer
      // match the labels below — seen, not reasoned: lines at 2/4/6/8% with labels at 1.30/2.62/
      // 4.07/5.77% read as two different scales overlaid. The cut points get their own lines in
      // the series' markLine instead, so a line means「a fifth of the companies are on this side」
      // rather than「this is a round number」.
      splitLine: { show: false },
      // Ticks at the four QUINTILE boundaries, not at even 2%/4%/6% steps（2026-09-24,「殖利率分布
      // 圖的 2% 4% 6% 8% 10% 的標示沒有意義，請把五等分位標示出來」）. An evenly-spaced scale tells
      // a reader where a number sits on a ruler; on a right-skewed distribution it says nothing
      // about how many companies are on either side of them, which is the only thing this chart
      // is for. The cut points do: today they fall at 1.30 / 2.62 / 4.07 / 5.77%, so the gap
      // between the first two holds as many companies as the gap between the last two.
      // `customValues` needs ECharts ≥5.5; the fallback below keeps the axis readable on older
      // ones rather than rendering an unlabelled line.
      ...(edges ? { min: edges.first, max: edges.last } : {}),
      ...(quantileValues.value.length
        ? {
            axisLabel: {
              color: distributionInk.value.muted,
              fontSize: 16,
              // 五等分位 ＋ 兩個端點。去重是必要的：分佈窄的時候 p20 可能就等於第一個資料點。
              customValues: [...new Set([...(edges ? [edges.first] : []), ...quantileValues.value, ...(edges ? [edges.last] : [])])],
              formatter: (value: number) => `${value.toFixed(2)}%`
            }
          }
        : { axisLabel: { color: distributionInk.value.muted, fontSize: 16, formatter: (value: number) => `${value.toFixed(1)}%` } })
    },
    yAxis: {
      type: 'value',
      name: '檔數',
      nameTextStyle: { color: distributionInk.value.muted, fontSize: 16 },
      splitLine: { lineStyle: { color: distributionInk.value.gridline, type: 'solid' } },
      axisLabel: { color: distributionInk.value.muted, fontSize: 16 }
    },
    series: [
      {
        name: '公司數量',
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: bins.map(bin => [bin.midpoint, bin.count]),
        lineStyle: { width: 2.5, color: distributionInk.value.muted },
        areaStyle: { color: distributionInk.value.muted, opacity: 0.18 },
        // Two kinds of vertical line, told apart by weight and by whether they carry a label: the
        // four quintile boundaries are quiet and unlabelled（the axis already names them below）,
        // this company's own yield is the one that says what it is.
        markLine: {
          silent: true,
          symbol: 'none',
          data: [
            ...quantileValues.value.map(value => ({
              xAxis: value,
              label: { show: false },
              lineStyle: { color: distributionInk.value.gridline, type: 'solid' as const, width: 1 }
            })),
            ...(dividendYield.value !== null
              ? [{
                  xAxis: dividendYield.value,
                  label: { formatter: '本檔', color: distributionInk.value.primary, fontSize: 16 },
                  lineStyle: { color: distributionInk.value.primary, type: 'dashed' as const, width: 2 }
                }]
              : [])
          ]
        }
      }
    ]
  }
})

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`
}

// Real bug fixed 2026-09-18 (reported live: "量尺的位置看起來不像是PR27") —
// SharedPercentileGaugeExpand's own marker position is a LINEAR interpolation between `min`/`max`
// (see that component's own markerPosition computed), not the percentile rank itself. Every
// EXISTING adopter (StockValuationRiverChart.vue etc.) feeds it a small ~20-40-point OWN-HISTORY
// window, where that distinction rarely reads as visibly wrong — but 現金殖利率 across the whole
// ~1,583-stock MARKET is heavily right-skewed (a long tail of very few high-yield outliers
// stretching max to ~19.6%, most stocks clustered far below that), so a stock at PR27 (0.92%) sat
// at barely ~5% of the way along a 0–19.6% linear bar — nowhere near where "27" reads on a 0–100
// scale, exactly the mismatch reported. Fixed by feeding the bar the PERCENTILE itself (0–100)
// as `current`/`min`/`max` instead of the raw yield value/its market extremes — the marker's
// linear position is then mathematically identical to the percentile by construction, no
// distribution-shape mismatch possible. `valueText` still shows the real 殖利率 percentage
// (that's the actual fact being described); only the BAR's own scale changed to percentile.
// The bar's scale is the PERCENTILE（see the comment above it）, so its two ends are the lowest
// and the highest yield among payers. Naming them in words rather than printing「0」and「100」:
// those two numbers describe the scale, not the market, and a reader counting dividend income has
// no use for them. The market's real range IS on the page — the expand's own range note states it
// — so nothing is lost by not repeating it on a bar that is 44px tall.
function formatScaleEnd(value: number): string {
  return value === 0 ? '最低' : '最高'
}
</script>

<template>
  <el-card class="dividend-yield-percentile-card" shadow="never">
    <template #header>
      <div class="dividend-yield-percentile-card__header">
        <StockCardTitle title="現金殖利率的市場排名" />
      </div>
    </template>

    <SharedEmptyState v-if="!pending && !hasData" description="這檔股票尚無殖利率資料，或市場排名暫時無法計算" />
    <SharedPercentileGaugeExpand
      v-else
      v-model:expanded="chartExpanded"
      :loading="pending"
      :current="percentile?.percentile ?? 0"
      :min="0"
      :max="100"
      :value-text="`現金殖利率 ${formatPercent(dividendYield ?? 0)}`"
      :percentile-text="percentile ? `有配息的 ${percentile.total.toLocaleString('en-US')} 家公司中，第 ${Math.round(percentile.percentile)} 百分位` : ''"
      :format-scale-value="formatScaleEnd"
      :gradient-from="priceColors.down"
      :gradient-to="priceColors.up"
      expand-label="展開看有配息公司的分布"
      collapse-label="收合分布圖"
    >
      <!-- 偏低／偏高 were in this sentence until 2026-09-24 and both are on the compliance register
             （shared/utils/compliance-words.ts）. The scanner never caught them because this whole card
             was client-only, so they were never in the server HTML it reads — moving the card into SSR
             is what surfaced them. Restated as where the companies sit, which is the same fact. -->
        <p class="dividend-yield-percentile-card__shape-note">殖利率的下界是 0%、沒有上界，所以有配息的公司多數集中在低值、少數落在右邊很遠的位置。這種往右拖長尾的形狀不是常態分布，也不代表資料有誤。</p>
      <SharedEmptyState v-if="!distributionPending && !distribution?.bins.length" description="市場分布資料暫時無法計算" />
      <template v-else>
        <SharedChart v-loading="distributionPending" class="dividend-yield-percentile-card__chart" :option="distributionOption" :init-options="{ renderer: 'svg' }" autoresize />
        <p v-if="distribution" class="dividend-yield-percentile-card__range-note">
          已排除不配息公司・圖表範圍 {{ formatPercent(distribution.clippedMin) }}～{{ formatPercent(distribution.clippedMax) }}（取第1～99百分位；有配息公司實際範圍 {{ formatPercent(distribution.trueMin) }}～{{ formatPercent(distribution.trueMax) }}，極端值併入左右兩端）
        </p>
      </template>
    </SharedPercentileGaugeExpand>
  </el-card>
</template>

<style scoped>
.dividend-yield-percentile-card {
  border-radius: 12px;
}

.dividend-yield-percentile-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dividend-yield-percentile-card__chart {
  height: 15rem;
  width: 100%;
}

.dividend-yield-percentile-card__shape-note {
  margin: 4px 16px 8px;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

.dividend-yield-percentile-card__range-note {
  margin: 4px 16px 0;
  font-size: 0.875rem;
  color: var(--el-text-color-placeholder);
}
</style>
