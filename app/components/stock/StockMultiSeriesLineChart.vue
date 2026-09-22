<script setup lang="ts">
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import type { MetricsHistoryEntry } from '#shared/types/metrics-history'
import { getAccentColor, getChartAccentGold, getChartInk, CHART_TOOLTIP, CHART_TOOLTIP_INK } from '~/utils/chart-palette'

use([SVGRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent])

// Several metricCodes over the same periods, one line each — extracted from
// app/pages/stock/[code]/margins.vue on 2026-09-21 alongside StockWaterfallChart, when the
// 安全韌性 page needed the identical chart for its own three ratios.
//
// Series are separated by LINE TYPE and SYMBOL SHAPE first and colour second（WCAG 1.4.1）: the
// user's own accent colour is one of the three, so two of them can legitimately resolve to the
// same hue on the GOLD accent, and shape still tells them apart. All three colours are ones this
// app has already verified against both surfaces（chart ink, the resolved accent, the darkened
// light-mode gold）rather than new hand-picked hexes. Every consumer also renders the same numbers
// as a real table, so the chart is never the only path to this data.
export interface LineSeriesSpec {
  code: string
  name: string
  lineType: 'solid' | 'dashed' | 'dotted'
  symbol: 'circle' | 'triangle' | 'rect' | 'diamond'
  // Which y-axis this line is measured against. Omitted（the case for every consumer that plots
  // one unit）means the left axis, so nothing had to change when the right one was added.
  axis?: 'left' | 'right'
  // Per-series formatter for the tooltip, for the mixed-unit case where one `format` would print
  // 0.55 次 as「0.55%」. Falls back to `format`.
  format?: (value: number | null) => string
}

const props = defineProps<{
  // Ascending (oldest first), as bff-ts returns it — time runs left to right on the x-axis.
  entries: MetricsHistoryEntry[]
  series: readonly LineSeriesSpec[]
  unit: string
  format: (value: number | null) => string
  // Set this to put a SECOND y-axis on the right and allow series to opt into it. Omitted = one
  // axis, exactly as before（2026-09-22, added for 杜邦分析, whose four lines are two percentages
  // and two multiples）. A dual axis is the honest way to draw those together: the alternative,
  // indexing every line to a common base, breaks on a loss-making year because a negative base
  // flips the sign of everything after it.
  unitRight?: string
}>()

const { resolvedMode, color: accentColorName } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))

// Four, since 杜邦分析 needs four lines. `secondary` is a verified data-line ink in both modes
// (see getChartInk's own comment) rather than a new hand-picked hex. Colour is still the LAST
// cue — line type and symbol shape carry the distinction (WCAG 1.4.1).
const seriesColors = computed(() => [
  getAccentColor(resolvedMode.value, accentColorName.value),
  chartInk.value.primary,
  getChartAccentGold(resolvedMode.value),
  chartInk.value.secondary
])

const periodLabel = (entry: { fiscalYear: number; fiscalQuarter: number }): string => `${entry.fiscalYear} Q${entry.fiscalQuarter}`

interface AxisTooltipParam { dataIndex?: number }

const chartOption = computed(() => {
  const list = props.entries
  return {
    textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
    // Top space reserved for the LEGEND, which wraps. 48 was a constant tuned when both consumers
    // had three short names（two rows at 375px）; 杜邦's four names with units take five rows there
    // and were measured drawing straight over the lines. One extra row per series past the second
    // covers the worst case — phone width, one entry per row — and at desktop, where the legend is
    // a single row, the surplus reads as spacing rather than as a defect.
    grid: { left: 8, right: 16, top: 48 + Math.max(0, props.series.length - 2) * 24, bottom: 28, containLabel: true },
    legend: { top: 0, textStyle: { color: chartInk.value.muted, fontSize: 16 } },
    tooltip: {
      trigger: 'axis',
      appendTo: 'body',
      backgroundColor: CHART_TOOLTIP.backgroundColor,
      borderColor: CHART_TOOLTIP.borderColor,
      textStyle: { color: CHART_TOOLTIP_INK.primary },
      formatter: (params: AxisTooltipParam | AxisTooltipParam[]) => {
        const entry = list[(Array.isArray(params) ? params[0] : params)?.dataIndex ?? 0]
        if (!entry) return ''
        const rows = props.series.map(series => `<div>${series.name}：${(series.format ?? props.format)(entry.values[series.code]?.value ?? null)}</div>`).join('')
        return `<div style="font-size:1rem"><div style="font-weight:600;margin-bottom:4px">${periodLabel(entry)}</div>${rows}</div>`
      }
    },
    xAxis: {
      type: 'category',
      data: list.map(entry => periodLabel(entry)),
      axisLine: { lineStyle: { color: chartInk.value.baseline } },
      axisTick: { show: false },
      axisLabel: { color: chartInk.value.muted, fontSize: 16 }
    },
    // The right axis draws no gridlines of its own — two interleaved sets of horizontal lines
    // read as a grid that belongs to neither series.
    yAxis: [
      {
        type: 'value',
        name: props.unit,
        nameTextStyle: { color: chartInk.value.muted, fontSize: 16 },
        splitLine: { lineStyle: { color: chartInk.value.gridline } },
        axisLabel: { color: chartInk.value.muted, fontSize: 16 }
      },
      ...(props.unitRight
        ? [{
            type: 'value',
            name: props.unitRight,
            nameTextStyle: { color: chartInk.value.muted, fontSize: 16 },
            splitLine: { show: false },
            axisLabel: { color: chartInk.value.muted, fontSize: 16 }
          }]
        : [])
    ],
    series: props.series.map((series, index) => ({
      name: series.name,
      type: 'line',
      yAxisIndex: series.axis === 'right' ? 1 : 0,
      symbol: series.symbol,
      symbolSize: 8,
      lineStyle: { width: 2, type: series.lineType, color: seriesColors.value[index] },
      itemStyle: { color: seriesColors.value[index] },
      // `connectNulls: false` on purpose — a period with no filed figure leaves a real gap in the
      // line rather than a straight segment implying a value that was never reported.
      connectNulls: false,
      data: list.map(entry => entry.values[series.code]?.value ?? null)
    }))
  }
})
</script>

<template>
  <SharedChart v-if="entries.length > 1" class="stock-multi-line-chart" :option="chartOption" :init-options="{ renderer: 'svg' }" autoresize />
</template>

<style scoped>
.stock-multi-line-chart {
  width: 100%;
  height: 320px;
}

/* The reserved legend space above comes out of the same 320px, so at phone width — where the
   legend actually wraps — the plot would be squeezed to pay for it. Give the height back instead
   of shrinking the lines. */
@media (max-width: 600px) {
  .stock-multi-line-chart {
    height: 400px;
  }
}
</style>
