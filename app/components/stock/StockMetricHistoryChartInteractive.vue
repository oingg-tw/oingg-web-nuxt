<script setup lang="ts">
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import type { MetricsHistoryTimeframe } from '#shared/types/metrics-history'
import type { LookbackWindow } from '~/utils/lookback-window'
import { computeGaugeStats, gaugeBandLabel } from '~/utils/percentile'
import { formatSignificantDigits } from '~/utils/format-significant-digits'

use([SVGRenderer, BarChart, GridComponent, TooltipComponent])

// The 目前值 chart for metric pages specifically（2026-09-21, direct request「el-card is-never-
// shadow stock-metric-page__card 卡片要可以切換單季或是近四季，期間要可以選1235年」, clarified the
// same day「不是每個卡片都要用TTM，但是都要可以選擇1235年」）— a separate component from
// StockMetricHistoryChart.vue (badge pages, unchanged) rather than retrofitting reactivity onto
// that already-shipped one; see that file's own comment. The two share option-building via
// useMetricHistoryChartOption.ts.
//
// 單季/近四季 toggle only renders when the metric genuinely offers both — `availableTimeframes`
// comes from the metric's own live catalog entry (GET /metrics' own `fields`), never assumed from
// the metricCode's name, matching「不是每個卡片都要用TTM」: a metric whose only real basis is TTM
// (or only Q) shows no toggle at all rather than one with a single, pointless option.
//
// Fetches reactively via useMetricsHistory (the composable every OTHER lookback-window card in
// this app already uses — StockHistoricalStatisticsTable.vue's own comment documents the same
// pattern), not the server route StockMetricDetailPage.vue itself calls for its initial SSR
// render. The parent pre-warms this composable's own cache (useStockPageDigest.ts's own prewarm()
// is the precedent) from that SSR fetch so the DEFAULT state (defaultTimeframe, 近5年) still
// renders real content in the server HTML — only a state the visitor actually switches to costs a
// fresh client request.
const props = defineProps<{
  symbol: string
  metricCode: string
  topic: string
  unit: string
  defaultTimeframe: MetricsHistoryTimeframe
  availableTimeframes: MetricsHistoryTimeframe[]
}>()

const TIMEFRAME_TOGGLE_LABEL: Record<MetricsHistoryTimeframe, string> = { TTM: '近四季', Q: '單季', FY: '年度' }
// Stable order regardless of what order the catalog happens to list `fields` in.
const timeframeOptions = computed(() => (['TTM', 'Q', 'FY'] as const).filter(tf => props.availableTimeframes.includes(tf)))

// Local, not shared useState — a "which basis" choice is metric-specific (not every metric even
// offers the same set), unlike the window below which is a general per-visitor preference. Resets
// correctly on its own since each metric page mounts its own instance of this component.
const timeframe = ref<MetricsHistoryTimeframe>(props.defaultTimeframe)
const window = useMetricHistoryChartWindow()

const symbolRef = computed(() => props.symbol)
const codesRef = computed(() => [props.metricCode])
const limit = computed(() => LOOKBACK_WINDOW_YEARS[window.value] * 4)
const { data, total, pending } = useMetricsHistory(symbolRef, codesRef, timeframe, limit)

// Same "genuine period count, not a rough threshold" rule as StockHistoricalStatisticsTable.vue's
// own disabledYears — a symbol with real data back only, say, 12 quarters would otherwise let
// 近5年/近8年 be picked and just silently show a mostly-empty chart.
const disabledYears = computed(() => LOOKBACK_YEARS.filter(years => total.value !== null && total.value! < years * 4))

// 「你連年數都不給我看，那我就是在賭，我不賭」— a reader could see 近10年 greyed out and had no way
// to tell whether that is this company's age or our gap. `total` was already fetched and used to
// DISABLE the options; it was simply never shown. This states it.
//
// It matters more now than when it was asked for: depth is per symbol, not per site（2330 has 24
// quarters, 8069 has 10, 6916 has 8）, and bff-ts traced the cause — each company's ceiling is
// where its 股本歷史 starts, since a per-share figure needs a share count. So the number is a fact
// about the company, not a number we are hiding.
//
// Floored, never rounded up: 23 quarters is 5.75 years and reads as 5, because overstating coverage
// is the failure this line exists to prevent. Sits with the window selector rather than under the
// chart — it explains a CONTROL（why an option is disabled）, not the picture, which is the line
//「圖表不配說明文字」draws.
const coverageText = computed(() => {
  const periods = total.value
  if (periods === null || periods <= 0) return null
  const years = Math.floor(periods / 4)
  return years >= 1 ? `本站共 ${periods} 季（約 ${years} 年）` : `本站共 ${periods} 季`
})

const points = computed(() =>
  (data.value ?? [])
    .map(entry => ({ fiscalYear: entry.fiscalYear, fiscalQuarter: entry.fiscalQuarter, value: entry.values[props.metricCode]?.value ?? null }))
    .filter((entry): entry is typeof entry & { value: number } => entry.value !== null)
)

// WHERE THIS NUMBER SITS IN ITS OWN HISTORY（2026-09-24,「我希望每個指標都跟 monthly-revenue 一樣，
// 跟某個東西相比以後特別顯得有用」, then「跟自己的過去比」and「只講位置，不做評價」）.
//
// Every single-metric page drew one series and left the reader with no way to tell whether the
// latest figure is high or low for THIS company. The comparison is the company's own record, not
// a peer median and not the share price: shared/types/stock-solvency-page.ts records the standing
// rule that a merely CORRELATED pairing（a fundamental against 股價）implies a claim about the
// company, with 月營收 × 股價 as the one accepted exception. A percentile over the company's own
// filed numbers asserts nothing — it is the same kind of statement as 安全韌性's subtraction chain.
//
// Nothing here is new machinery. app/utils/percentile.ts and SharedPercentileGaugeExpand.vue were
// both extracted for exactly this question（that component's own comment:「where does this single
// value sit in its own history/peer range」）and until now reached only peRatio and pbRatio, via
// the digest. This wires the same two to the other 17 metric pages.
//
// It lives in THIS component rather than the page because the window and basis selectors are
// here. A gauge computed from the page's own SSR series would keep describing 20 quarters after
// the reader switched the chart to 8.
//
// 8 periods, measured rather than picked: across all 19 metric pages × 6 symbols（114 pairs that
// returned data）8 keeps 89% of them, 4 would keep 92% and 10 only 80% — the curve is flat below
// 8 and starts costing above it. Below the floor the gauge does not render at all, rather than
// placing a value among three or four points and calling the result a percentile. Counted on
// non-null periods, since a period with no filed figure is not a value.
const MIN_GAUGE_PERIODS = 8

const gaugeStats = computed(() => {
  // `points` is ascending（the chart draws it left to right）, so the newest figure is last.
  const values = points.value.map(point => point.value)
  if (values.length < MIN_GAUGE_PERIODS) return null
  return computeGaugeStats(values, values[values.length - 1] ?? null)
})

const PERIOD_WORD: Record<MetricsHistoryTimeframe, string> = { TTM: '季', Q: '季', FY: '年' }

const gaugeValueText = computed(() =>
  gaugeStats.value ? `${props.topic} ${formatSignificantDigits(gaugeStats.value.current, 3)}${props.unit}` : ''
)

// States the ACTUAL period count, never a rounded「近5年」— the window selector can be on 近5年
// while the company only filed 13 of those quarters, and the sentence has to be true of what was
// measured. The band label comes from percentile.ts, whose own comment records why it is worded
// as three statistical ranges and never as 便宜/合理/昂貴.
const gaugePercentileText = computed(() => {
  const stats = gaugeStats.value
  if (!stats) return ''
  return `近 ${points.value.length} ${PERIOD_WORD[timeframe.value]}第 ${Math.round(stats.currentPercentile)} 百分位（${gaugeBandLabel(stats)}）`
})

// The bar is fed the PERCENTILE（0–100）rather than the raw value, so the marker's own linear
// position IS the percentile by construction. StockDividendYieldPercentileCard.vue's comment
// records why that matters: the marker interpolates linearly between min and max, so a skewed
// window puts it nowhere near where the stated percentile reads. Labelling the two ends with the
// window's real lowest and highest figure is exactly correct under that scale — percentile 0 IS
// the minimum and 100 IS the maximum.
function formatGaugeScale(value: number): string {
  const stats = gaugeStats.value
  if (!stats) return ''
  return `${formatSignificantDigits(value === 0 ? stats.min : stats.max, 3)}${props.unit}`
}

const { chartOption } = useMetricHistoryChartOption(
  points,
  computed(() => props.topic),
  computed(() => props.unit),
  timeframe
)

function handleWindowChange(value: LookbackWindow) {
  window.value = value
}
</script>

<template>
  <div class="stock-metric-history-chart-interactive">
    <!-- Corner-positioned against the ancestor card, not this div — see
         StockMetricDetailPage.vue's own .stock-metric-page__card comment（「lookback-window-select
         請放在卡片右上角」）. TTM/單季 sits to its LEFT inside the same corner group, per direct
         follow-up（「每個卡片 近五年的左邊要有選項選擇 TTM 或是 單季」）— one group, not two separate
         rows, with the toggle first in source/visual order. -->
    <div class="stock-metric-history-chart-interactive__corner">
      <el-radio-group v-if="timeframeOptions.length > 1" v-model="timeframe" aria-label="期別（單季或近四季）">
        <el-radio-button v-for="tf in timeframeOptions" :key="tf" :value="tf">{{ TIMEFRAME_TOGGLE_LABEL[tf] }}</el-radio-button>
      </el-radio-group>
      <SharedLookbackWindowSelect :model-value="window" :disabled-years="disabledYears" @update:model-value="handleWindowChange" />
      <p v-if="coverageText" class="stock-metric-history-chart-interactive__coverage">{{ coverageText }}</p>
    </div>
    <!-- No expand toggle: the detail it would reveal is the chart, which is already right below.
         A neutral single-hue ramp, NOT the up/down pair StockDividendYieldPercentileCard passes —
         red-to-green would say a high value is good, which is false for 負債比率 and is a verdict
         either way（「只講位置，不做評價」）. -->
    <SharedPercentileGaugeExpand
      v-if="gaugeStats"
      :show-toggle="false"
      :expanded="false"
      :current="gaugeStats.currentPercentile"
      :min="0"
      :max="100"
      :value-text="gaugeValueText"
      :percentile-text="gaugePercentileText"
      :format-scale-value="formatGaugeScale"
      gradient-from="var(--el-color-primary-light-8)"
      gradient-to="var(--el-color-primary)"
    />
    <!-- Needs ≥2 bars to read as a trend at all; a single-period window (or a fetch that hasn't
         resolved yet) renders nothing rather than a one-bar chart. -->
    <SharedChart v-if="points.length > 1" v-loading="pending" class="stock-metric-history-chart-interactive__chart" :option="chartOption" :init-options="{ renderer: 'svg' }" autoresize />
    <SharedEmptyState v-else-if="!pending" description="這個期間沒有足夠的資料可以畫圖" />
  </div>
</template>

<style scoped>
/* Quiet and right-aligned under the two controls it belongs to — a statement about how much data
   exists, not a caption for the chart. */
.stock-metric-history-chart-interactive__coverage {
  flex-basis: 100%;
  margin: 0;
  text-align: right;
  font-size: 0.875rem;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}

.stock-metric-history-chart-interactive {
  margin-top: 12px;
}

.stock-metric-history-chart-interactive__corner {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
}

/* 「radio select 高度不同 希望可以讓他看起來不突兀」(2026-09-21). The two controls' OUTER boxes
   already measured the same 32px and sat on the same top edge — what differed was the chrome a
   reader actually sees: el-select draws its border on .el-select__wrapper, which fills that 32px,
   while el-radio-button draws its own pill on .el-radio-button__inner, which Element Plus sizes
   from padding alone and which measured 26px. So two bordered boxes side by side, one 6px shorter
   than the other. Measured rather than eyeballed, which is why the fix is on the INNER element —
   setting a height on the group itself would have changed nothing visible.

   :deep() because both targets live inside Element Plus's own markup, not this component's. */
.stock-metric-history-chart-interactive__corner :deep(.el-radio-button__inner) {
  display: inline-flex;
  align-items: center;
  height: 32px;
}

/* Clearance for the corner controls, which are absolutely positioned against the CARD — so they
   overlap whatever the card's first child happens to be, and as of 2026-09-24 that is the gauge
   （reported:「debt-ratio 右上角的select與圖表有文字遮蓋」）. The gauge's percentile text is flush
   right, by the shared component's own `justify-content: space-between`, which put it straight
   under the select.
   Measured rather than guessed, at 1280 and 375: the corner sits at y=13 and is 32px tall, so its
   bottom edge is 45px down, while the gauge's first row started at 29px. 28px of padding (up from
   the component's own 4px) moves it to 53px — 8px clear. The widest corner is 262px (basis toggle
   plus window select) and still fits one row at 375px, so one row is the case to clear.
   Padding on the GAUGE, not a margin on this whole component: the chart alone never needed the
   clearance（it has its own top space）and a metric under the 8-period floor renders no gauge at
   all, so nothing should move for it. */
.stock-metric-history-chart-interactive :deep(.percentile-gauge) {
  padding-top: 28px;
}

.stock-metric-history-chart-interactive__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

/* Same fixed height StockDividendYieldPercentileCard.vue's own chart uses — this app's other
   SharedChart consumer, kept for a consistent chart footprint rather than a one-off value here. */
.stock-metric-history-chart-interactive__chart {
  height: 15rem;
  width: 100%;
  margin-top: 12px;
}
</style>
