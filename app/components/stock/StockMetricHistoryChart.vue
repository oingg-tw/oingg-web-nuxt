<script setup lang="ts">
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import type { MetricsHistoryEntry, MetricsHistoryTimeframe } from '#shared/types/metrics-history'
import { formatSignificantDigits } from '~/utils/format-significant-digits'
import { getAccentColor, getChartInk, CHART_TOOLTIP, CHART_TOOLTIP_INK } from '~/utils/chart-palette'

use([SVGRenderer, BarChart, GridComponent, TooltipComponent])

// The 目前值 bar chart, extracted 2026-09-21 out of StockMetricDetailPage.vue（where it first
// shipped for EPS, per「EPS stock-metric-page__card 改成長條圖」）once the same request widened to
// StockBadgeDetailPage.vue too（「gross-margin 這邊的 el-card__body 也要用圖表，以後只要是諸如 EPS
// 營收 ROA 這種指標，就要有圖表」）— both templates' 目前值 card ends in "one number with a
// history," so the chart itself belongs here once, not copy-pasted a second time into the badge
// template. Callers own the fetch and the surrounding card/text; this component owns only
// "entries → bars."
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

const periodLabel = (fiscalYear: number, fiscalQuarter: number): string =>
  props.timeframe === 'FY' ? `${fiscalYear}` : `${fiscalYear} Q${fiscalQuarter}`

const valueTextOf = (value: number): string => `${formatSignificantDigits(value, 3)}${props.unit}`

const { resolvedMode, color: accentColorName } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))
const accentColor = computed(() => getAccentColor(resolvedMode.value, accentColorName.value))

interface BarTooltipParam { dataIndex?: number }

const chartOption = computed(() => {
  const list = points.value
  return {
    textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
    grid: { left: 8, right: 16, top: 16, bottom: 28, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      appendTo: 'body',
      backgroundColor: CHART_TOOLTIP.backgroundColor,
      borderColor: CHART_TOOLTIP.borderColor,
      textStyle: { color: CHART_TOOLTIP_INK.primary },
      formatter: (params: BarTooltipParam | BarTooltipParam[]) => {
        const entry = list[(Array.isArray(params) ? params[0] : params)?.dataIndex ?? 0]
        if (!entry) return ''
        return `<div style="font-size:1rem"><div style="font-weight:600;margin-bottom:4px">${periodLabel(entry.fiscalYear, entry.fiscalQuarter)}</div>${valueTextOf(entry.value)}</div>`
      }
    },
    xAxis: {
      type: 'category',
      data: list.map(entry => periodLabel(entry.fiscalYear, entry.fiscalQuarter)),
      axisLine: { lineStyle: { color: chartInk.value.baseline } },
      axisTick: { show: false },
      axisLabel: { color: chartInk.value.muted, fontSize: 16 }
    },
    yAxis: {
      type: 'value',
      name: props.unit,
      nameTextStyle: { color: chartInk.value.muted, fontSize: 16 },
      splitLine: { lineStyle: { color: chartInk.value.gridline } },
      axisLabel: { color: chartInk.value.muted, fontSize: 16 }
    },
    series: [
      {
        name: props.topic,
        type: 'bar',
        data: list.map((entry, index) => ({
          value: entry.value,
          // The latest bar in a highlighted shade so "where we are now" is visible at a glance —
          // the same role a table's own bold current-period row plays where one exists alongside.
          itemStyle: index === list.length - 1 ? { color: chartInk.value.primary } : { color: accentColor.value }
        }))
      }
    ]
  }
})
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
