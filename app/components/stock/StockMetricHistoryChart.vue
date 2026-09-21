<script setup lang="ts">
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import type { MetricsHistoryEntry, MetricsHistoryTimeframe } from '#shared/types/metrics-history'

use([SVGRenderer, BarChart, GridComponent, TooltipComponent])

// The 目前值 bar chart, extracted 2026-09-21 out of StockMetricDetailPage.vue（where it first
// shipped for EPS, per「EPS stock-metric-page__card 改成長條圖」）once the same request widened to
// StockBadgeDetailPage.vue too（「gross-margin 這邊的 el-card__body 也要用圖表，以後只要是諸如 EPS
// 營收 ROA 這種指標，就要有圖表」）— both templates' 目前值 card ends in "one number with a
// history," so the chart itself belongs here once, not copy-pasted a second time into the badge
// template. Callers own the fetch and the surrounding card/text; this component owns only
// "entries → bars."
//
// Stayed STATIC (this file unchanged in shape) when metric pages gained a reactive
// timeframe/window toggle the same day（「el-card is-never-shadow stock-metric-page__card 卡片要
// 可以切換單季或是近四季，期間要可以選1235年」）— that request named the METRIC page's own card
// class specifically, badge pages weren't asked for it, so StockMetricHistoryChartInteractive.vue
// is a separate component rather than retrofitting reactivity onto this already-shipped,
// verified one. The two share their option-building logic via useMetricHistoryChartOption.ts
// rather than duplicating it.
//
// Takes raw `entries` (oldest-first, exactly what GET /stocks/:symbol/metrics-history returns)
// rather than a caller-shaped points array — that keeps both call sites' own `points` computed
// (each already reversed to newest-first for ITS OWN lead sentence/table, a different, real need)
// untouched; this component does its own null-filtering and re-reverses to chronological order
// for the x-axis independently, rather than depending on a caller passing it pre-shaped data in
// whichever order happened to be convenient there.
const props = defineProps<{
  entries: MetricsHistoryEntry[]
  metricCode: string
  topic: string
  unit: string
  timeframe: MetricsHistoryTimeframe
}>()

const points = computed(() =>
  props.entries
    .map(entry => ({ fiscalYear: entry.fiscalYear, fiscalQuarter: entry.fiscalQuarter, value: entry.values[props.metricCode]?.value ?? null }))
    .filter((entry): entry is typeof entry & { value: number } => entry.value !== null)
)

const { chartOption } = useMetricHistoryChartOption(
  points,
  computed(() => props.topic),
  computed(() => props.unit),
  computed(() => props.timeframe)
)
</script>

<template>
  <!-- Needs ≥2 bars to read as a trend at all; a single-period page (metric just published, or an
       unusually shallow series) renders nothing rather than a one-bar chart. -->
  <SharedChart v-if="points.length > 1" class="stock-metric-history-chart" :option="chartOption" :init-options="{ renderer: 'svg' }" autoresize />
</template>

<style scoped>
/* Same fixed height StockDividendYieldPercentileCard.vue's own chart uses — this app's other
   SharedChart consumer, kept for a consistent chart footprint rather than a one-off value here. */
.stock-metric-history-chart {
  height: 15rem;
  width: 100%;
  margin-top: 12px;
}
</style>
