<script setup lang="ts">
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import type { MetricsHistoryTimeframe } from '#shared/types/metrics-history'
import type { LookbackWindow } from '~/utils/lookback-window'

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

const points = computed(() =>
  (data.value ?? [])
    .map(entry => ({ fiscalYear: entry.fiscalYear, fiscalQuarter: entry.fiscalQuarter, value: entry.values[props.metricCode]?.value ?? null }))
    .filter((entry): entry is typeof entry & { value: number } => entry.value !== null)
)

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
    </div>
    <!-- Needs ≥2 bars to read as a trend at all; a single-period window (or a fetch that hasn't
         resolved yet) renders nothing rather than a one-bar chart. -->
    <SharedChart v-if="points.length > 1" v-loading="pending" class="stock-metric-history-chart-interactive__chart" :option="chartOption" :init-options="{ renderer: 'svg' }" autoresize />
    <SharedEmptyState v-else-if="!pending" description="這個期間沒有足夠的資料可以畫圖" />
  </div>
</template>

<style scoped>
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
