<script setup lang="ts">
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, MarkAreaComponent } from 'echarts/components'
import { getAccentColor, getChartAccentGold, getChartInk, getPriceColors, CHART_TOOLTIP, CHART_TOOLTIP_INK } from '~/utils/chart-palette'

use([SVGRenderer, BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent, MarkAreaComponent])

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
  // Bars for a LEVEL, lines for a RATE — the 月營收 page's reason for wanting both on one chart
  // (2026-09-23): revenue is an amount that stands on its own each month, while its year-on-year
  // change is a relationship between two of them. Drawing both as lines would invite reading the
  // gap between them as meaningful when the two axes are unrelated. Omitted = line, so no existing
  // caller changed.
  type?: 'line' | 'bar'
  // Shade the PERIODS in which this series was negative — full-height vertical bands on the time
  // axis, the recession-shading idiom（2026-09-23）.
  //
  // Two earlier attempts at the same fact were both wrong, and the reason is worth keeping:
  //
  //   1. Colouring each BAR by its sign（`signBy`）spent the colour channel on something the zero
  //      axis already says, and then left the series itself with no hue to be identified by — the
  //      legend swatch had to be drawn neutral, which is the tell that the encoding was wrong.
  //   2. A horizontal band from the axis floor up to zero is anchored to ONE y-axis, and on a
  //      dual-axis chart the other series runs straight through it. Drawn and looked at: 2330's
  //      月均價 line sat inside the「negative」tint for three of five years, which is simply false
  //      information about the series it crosses.
  //
  // A vertical band is anchored to TIME, which every series on the chart shares, so it cannot say
  // anything about a value it does not own. It also answers the question in the words it was
  // asked in —「負成長的區段」.
  //
  // The tint follows this app's market-convention tokens rather than a literal green, because
  // which colour means「down」is a per-reader setting: Taiwan reads red as up, the West the other
  // way, and a third option swaps both for a colourblind-safe pair.
  //
  // Colour is not the only cue（「任何漲跌/數值類資訊禁止純靠色彩」）: the shaded months are exactly
  // the ones where this series is below its own labelled zero line, readable by position alone.
  negativeBand?: boolean
}

// What this chart needs from a row, which is less than a MetricsHistoryEntry carries. Widened
// 2026-09-23 so a MONTHLY series can use the same component: `label` overrides the「2026 Q2」the
// fiscal fields produce, and a MetricsHistoryEntry still satisfies this structurally, so no
// existing caller changed.
export interface LineChartEntry {
  fiscalYear?: number
  fiscalQuarter?: number
  label?: string
  values: Record<string, { value: number | null } | null | undefined>
}

const props = defineProps<{
  // Ascending (oldest first), as bff-ts returns it — time runs left to right on the x-axis.
  entries: LineChartEntry[]
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

const { resolvedMode, color: accentColorName, market } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))
const priceColors = computed(() => getPriceColors(resolvedMode.value, market.value))

// Four, since 杜邦分析 needs four lines. `secondary` is a verified data-line ink in both modes
// (see getChartInk's own comment) rather than a new hand-picked hex. Colour is still the LAST
// cue — line type and symbol shape carry the distinction (WCAG 1.4.1).
const seriesColors = computed(() => [
  getAccentColor(resolvedMode.value, accentColorName.value),
  chartInk.value.primary,
  getChartAccentGold(resolvedMode.value),
  chartInk.value.secondary
])

// Index ranges of the consecutive periods where a series is below zero. A null period BREAKS a run
// rather than extending it —「not reported」is not「negative」, and shading it would assert a fall
// that was never filed.
function negativeRuns(list: LineChartEntry[], code: string): [number, number][] {
  const runs: [number, number][] = []
  let start: number | null = null
  list.forEach((entry, index) => {
    const value = entry.values[code]?.value
    if (value != null && value < 0) {
      if (start === null) start = index
    } else if (start !== null) {
      runs.push([start, index - 1])
      start = null
    }
  })
  if (start !== null) runs.push([start, list.length - 1])
  return runs
}

const periodLabel = (entry: LineChartEntry): string => entry.label ?? `${entry.fiscalYear} Q${entry.fiscalQuarter}`

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
    legend: {
      top: 0,
      textStyle: { color: chartInk.value.muted, fontSize: 16 },
      data: props.series.map(series => series.name)
    },
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
      type: series.type ?? 'line',
      yAxisIndex: series.axis === 'right' ? 1 : 0,
      // Bars draw behind lines regardless of source order, so a line is never hidden by the
      // column it sits over.
      z: series.type === 'bar' ? 1 : 3,
      ...(series.type === 'bar'
        ? { barMaxWidth: 18, itemStyle: { color: seriesColors.value[index] } }
        : {
            symbol: series.symbol,
            symbolSize: 8,
            lineStyle: { width: 2, type: series.lineType, color: seriesColors.value[index] },
            itemStyle: { color: seriesColors.value[index] },
            // `connectNulls: false` on purpose — a period with no filed figure leaves a real gap
            // in the line rather than a straight segment implying a value that was never reported.
            connectNulls: false
          }),
      // One band per CONTIGUOUS run of negative periods, rather than one per period: adjacent bands
      // would draw their edges against each other and read as stripes within a single downturn.
      // The ±0.5 puts each edge on the category boundary instead of on a point, so a one-period
      // run is a band the width of a period rather than a zero-width line.
      // `silent` so it never takes the axis tooltip from the points drawn over it.
      ...(series.negativeBand
        ? {
            markArea: {
              silent: true,
              itemStyle: { color: priceColors.value.down, opacity: 0.14 },
              data: negativeRuns(list, series.code).map(([from, to]) => [{ xAxis: from - 0.5 }, { xAxis: to + 0.5 }])
            }
          }
        : {}),
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
