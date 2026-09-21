<script setup lang="ts">
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { CustomChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { getAccentColor, getChartInk, CHART_TOOLTIP, CHART_TOOLTIP_INK } from '~/utils/chart-palette'

// An unregistered ECharts SERIES TYPE throws nothing at all — it silently draws no series, leaving
// axes and labels around an empty plot area. Found that way on 2026-09-21; anything added to the
// option below needs its own entry here.
use([SVGRenderer, CustomChart, GridComponent, TooltipComponent])

// Horizontal waterfall — extracted from app/pages/stock/[code]/margins.vue on 2026-09-21 when the
// 安全韌性 page needed the same chart for a different chain（流動比率 → 速動比率 → 現金比率）.
// Extracted rather than copied: the custom-series maths below is tuned（the zero-crossing case, the
// 2px floor, the label placement, the hand-applied text scale）and a second hand-maintained copy
// would have drifted from it silently.
//
// A step is a bar spanning `start` → `end`; `delta: null` marks the bars measured from zero — the
// anchors of the chain, drawn in the accent colour — while the rest float between the running
// figure before and after them.
export interface WaterfallStep {
  label: string
  start: number
  end: number
  delta: number | null
}

const props = defineProps<{
  steps: WaterfallStep[]
  // Both formatters come from the page: the two consumers show 倍 and % and the chart has no
  // business knowing which. `formatSigned` renders the ADD-to-running-total convention both
  // consumers use, so a 加減 row can be chained straight down the column.
  format: (value: number) => string
  formatSigned: (value: number) => string
}>()

const { resolvedMode, color: accentColorName } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))
const { scale: textScale } = useTextScale()

interface AxisTooltipParam { dataIndex?: number }

const chartOption = computed(() => {
  const steps = props.steps
  const accent = getAccentColor(resolvedMode.value, accentColorName.value)
  // useTextScale's `scale` is the SETTING token（'100' | '110' | '120'), not a ratio — the same
  // Number(scale)/100 conversion SharedChart itself does before walking the option tree.
  const labelFont = `${(16 * Number(textScale.value)) / 100}px system-ui, -apple-system, "Segoe UI", sans-serif`
  return {
    textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
    // right: 64 reserves room for the value label each bar hangs past its own right edge — with
    // the usual 16px the widest bar's label（毛利率, the chart's full extent）was clipped by the
    // plot edge. containLabel keeps the category names on the left inside the box.
    grid: { left: 8, right: 64, top: 8, bottom: 32, containLabel: true },
    tooltip: {
      trigger: 'item',
      appendTo: 'body',
      backgroundColor: CHART_TOOLTIP.backgroundColor,
      borderColor: CHART_TOOLTIP.borderColor,
      textStyle: { color: CHART_TOOLTIP_INK.primary },
      formatter: (params: AxisTooltipParam) => {
        const step = steps[params?.dataIndex ?? 0]
        if (!step) return ''
        const body = step.delta === null
          ? props.format(step.end)
          : `${props.formatSigned(step.delta)}（${props.format(step.start)} → ${props.format(step.end)}）`
        return `<div style="font-size:1rem"><div style="font-weight:600;margin-bottom:4px">${step.label}</div>${body}</div>`
      }
    },
    // Categories down the Y axis, value across the X — flipped from the vertical-bar version
    // 2026-09-21（「可以改變為縱向的瀑布圖嗎」）. It reads the way the statement it describes does,
    // top to bottom from 毛利率 to 稅後淨利率, and it retires the rotate: 30 the vertical version
    // needed: a horizontal category axis had to angle「推銷及管理」/「業外與稅」to fit seven of them
    // at phone width, where down the side they each get a full row.
    //
    // `inverse: true` is what puts 毛利率 at the TOP — ECharts starts a category y-axis at index 0
    // on the BOTTOM, which would print the whole statement upside down.
    xAxis: {
      type: 'value',
      name: '%',
      nameTextStyle: { color: chartInk.value.muted, fontSize: 16 },
      splitLine: { lineStyle: { color: chartInk.value.gridline } },
      axisLabel: { color: chartInk.value.muted, fontSize: 16 }
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: steps.map(step => step.label),
      axisLine: { lineStyle: { color: chartInk.value.baseline } },
      axisTick: { show: false },
      // interval: 0 forces EVERY category to print — ECharts drops labels it thinks will collide,
      // and a waterfall with unlabelled bars is unreadable.
      axisLabel: { interval: 0, color: chartInk.value.muted, fontSize: 16 }
    },
    series: [
      {
        type: 'custom',
        encode: { x: [1, 2], y: 0 },
        renderItem: (_params: unknown, api: {
          value: (index: number) => number
          coord: (point: number[]) => number[]
          size: (value: number[]) => number[]
          style: () => Record<string, unknown>
        }) => {
          const index = api.value(0)
          const from = api.coord([api.value(1), index])
          const to = api.coord([api.value(2), index])
          // A 2px floor on the drawn LENGTH（see waterfallSteps' own comment）keeps a genuinely-zero
          // step from vanishing; `height` is the bar's thickness across the category band.
          const height = api.size([0, 1])[1]! * 0.55
          const left = Math.min(from[0]!, to[0]!)
          const width = Math.max(Math.abs(to[0]! - from[0]!), 2)
          const step = steps[index]
          const text = step ? (step.delta === null ? props.format(step.end) : props.formatSigned(step.delta)) : ''
          return {
            type: 'group',
            children: [
              { type: 'rect', shape: { x: left, y: from[1]! - height / 2, width, height }, style: api.style() },
              {
                // Always just past the bar's RIGHT edge, whichever direction the bar runs — a
                // left-running（negative）step then labels at its start rather than its end, which
                // keeps every label on one vertical line instead of zig-zagging with the chain.
                // grid.right below reserves the room this needs outside the plot area.
                type: 'text',
                style: {
                  text,
                  x: left + width + 8,
                  y: from[1]!,
                  textAlign: 'left',
                  textVerticalAlign: 'middle',
                  fill: chartInk.value.primary,
                  font: labelFont
                }
              }
            ]
          }
        },
        data: steps.map((step, index) => ({
          value: [index, step.start, step.end],
          // The three rate bars in the accent colour as the chain's anchors; the steps between them
          // in the muted ink. Direction is NOT carried by colour（no red/green）: a margin step is
          // not a price move, and colouring 減 red would read as a judgement this page doesn't
          // make. Each bar's own signed label plus its vertical position carry the direction.
          itemStyle: { color: step.delta === null ? accent : chartInk.value.secondary }
        }))
      }
    ]
  }
})
</script>

<template>
  <SharedChart class="stock-waterfall-chart" :option="chartOption" :init-options="{ renderer: 'svg' }" autoresize />
</template>

<style scoped>
/* Sized from the ROW COUNT rather than a fixed height — each step needs a full 16px label line
   plus its bar, and the two consumers have different numbers of steps. */
.stock-waterfall-chart {
  width: 100%;
  height: calc(60px + v-bind('`${props.steps.length * 48}px`'));
}
</style>
