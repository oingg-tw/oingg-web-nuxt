<script setup lang="ts">
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
// actually pay a dividend"), not a fake bell curve. Exposed here as `excludeZeroYield`, an
// explicit opt-in toggle (default off — the full-market picture, including non-payers, is the
// more complete fact) rather than switching the default view, so neither version is hidden from
// the reader.
//
// A `logScale` toggle was tried and removed same day ("我想看看Log座標效果如何" → "好吧，那就維持
// 原案。請幫我把多的控制項拿掉，簡化圖表"): re-plotting the SAME server-computed equal-WIDTH bins
// on a log x-axis, live-verified, still peaked at the left edge — the mass sits in one wide
// low-value bin regardless of axis scale, so the preview only confirmed the shape mismatch is a
// binning issue, not an axis one (a real log-histogram would need bins recomputed server-side from
// log(field), which analysis-ts declined to add). Not worth keeping as a permanent control once it
// had nothing left to show.
// 30-char cap (feedback_info_text_30_char_limit) AND the compliance register (2.4.3 / 刪形容詞測試):
// the previous text said「贏過越多檔股票」and「不代表股價便宜或昂貴」— both on the banned-word list
// even in a disclaimer's mouth — and ran to 60+ characters. Statistical position only.
const INFO_TEXT = '目前殖利率在全市場的百分位排名'

const props = defineProps<{
  symbol: string
}>()

const symbolRef = computed(() => props.symbol)
const { data: snapshot, pending: snapshotPending } = useDividendStabilitySnapshot(symbolRef)

const dividendYield = computed<number | null>(() => {
  const raw = snapshot.value?.['dividendYield.EOD']?.value
  return raw != null ? Number(raw) : null
})

const { data: rank, pending: rankPending } = useMarketPercentileRank('dividendYield.EOD', dividendYield)

const pending = computed(() => snapshotPending.value || rankPending.value)
const hasData = computed(() => dividendYield.value !== null && rank.value !== null)

// enabled=chartExpanded — the distribution fetch only fires once the card is actually expanded,
// not on every page load alongside the gauge's own single percentile-rank pair.
const chartExpanded = ref(false)
const excludeZeroYield = ref(false)
const { data: distribution, pending: distributionPending } = useMarketYieldDistribution('dividendYield.EOD', chartExpanded, excludeZeroYield)

const { resolvedMode, market } = useAppTheme()
const priceColors = computed(() => getPriceColors(resolvedMode.value, market.value))
const distributionInk = computed(() => getChartInk(resolvedMode.value))

interface DistributionTooltipParam { dataIndex?: number }

const distributionOption = computed(() => {
  const bins = distribution.value?.bins ?? []
  return {
    textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
    grid: { left: 8, right: 16, top: 16, bottom: 28, containLabel: true },
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
      nameTextStyle: { color: distributionInk.value.muted, fontSize: 16 },
      axisLine: { lineStyle: { color: distributionInk.value.baseline } },
      axisTick: { show: false },
      axisLabel: { color: distributionInk.value.muted, fontSize: 16, formatter: (value: number) => `${value.toFixed(1)}%` }
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
        ...(dividendYield.value !== null
          ? {
              markLine: {
                silent: true,
                symbol: 'none',
                label: { formatter: '本檔', color: distributionInk.value.primary, fontSize: 16 },
                lineStyle: { color: distributionInk.value.primary, type: 'dashed', width: 2 },
                data: [{ xAxis: dividendYield.value }]
              }
            }
          : {})
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
function formatScalePercentile(value: number): string {
  return `${Math.round(value)}`
}
</script>

<template>
  <el-card class="dividend-yield-percentile-card" shadow="never">
    <template #header>
      <div class="dividend-yield-percentile-card__header">
        <StockCardTitle title="現金殖利率的市場排名" :info-text="INFO_TEXT" />
      </div>
    </template>

    <SharedEmptyState v-if="!pending && !hasData" description="這檔股票尚無殖利率資料，或市場排名暫時無法計算" />
    <SharedPercentileGaugeExpand
      v-else
      v-model:expanded="chartExpanded"
      :loading="pending"
      :current="rank?.percentile ?? 0"
      :min="0"
      :max="100"
      :value-text="`現金殖利率 ${formatPercent(dividendYield ?? 0)}`"
      :percentile-text="rank ? `全市場第 ${Math.round(rank.percentile)} 百分位（PR${Math.round(rank.percentile)}）` : ''"
      :format-scale-value="formatScalePercentile"
      :gradient-from="priceColors.down"
      :gradient-to="priceColors.up"
      expand-label="展開看全市場分布"
      collapse-label="收合分布圖"
    >
      <p class="dividend-yield-percentile-card__shape-note">多數公司殖利率偏低或掛零、少數公司偏高——殖利率下界是 0%、沒有上界，本來就會是這種集中在低值、往右拖長尾的形狀，不是常態分布，不代表資料有誤。</p>
      <label class="dividend-yield-percentile-card__exclude-zero">
        <el-switch v-model="excludeZeroYield" />
        只看有配息的公司（排除殖利率 0% 者）
      </label>
      <SharedEmptyState v-if="!distributionPending && !distribution?.bins.length" description="市場分布資料暫時無法計算" />
      <template v-else>
        <SharedChart v-loading="distributionPending" class="dividend-yield-percentile-card__chart" :option="distributionOption" :init-options="{ renderer: 'svg' }" autoresize />
        <p v-if="distribution" class="dividend-yield-percentile-card__range-note">
          {{ excludeZeroYield ? '已排除不配息公司・' : '' }}圖表範圍 {{ formatPercent(distribution.clippedMin) }}～{{ formatPercent(distribution.clippedMax) }}（取第1～99百分位；全市場實際範圍 {{ formatPercent(distribution.trueMin) }}～{{ formatPercent(distribution.trueMax) }}，極端值併入左右兩端）
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

.dividend-yield-percentile-card__exclude-zero {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 16px 8px;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
  cursor: pointer;
}

.dividend-yield-percentile-card__range-note {
  margin: 4px 16px 0;
  font-size: 0.875rem;
  color: var(--el-text-color-placeholder);
}
</style>
