<script setup lang="ts">
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { RadarChart } from 'echarts/charts'
import { RadarComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'

use([CanvasRenderer, RadarChart, RadarComponent, TooltipComponent])

const props = defineProps<{
  // Same fixed order as RADAR_AXES (guru-radar-data.ts) — this component doesn't know or
  // care that they came from there, it just plots whatever axis/value pairs it's handed.
  axes: { label: string; value: number }[]
}>()

// Per-axis max is fixed at 4 (not derived from the current selection's own peak) — the whole
// point of this radar per docs/regulatory-compliance/...研究報告.md's conductor-confirmed
// design is that only RELATIVE axis shape matters, never an implied "how close to 100% is
// this," so the scale has to stay constant as indicators are added/removed rather than
// auto-rescaling to always look "full." 4 comes from Piotroski F-Score alone contributing 1
// point to four separate axes (guru-radar-data.ts's own GURU_INDICATORS) — the single
// heaviest indicator in the catalog — floored so a lighter selection still renders inside a
// sensible frame instead of a razor-thin sliver.
const AXIS_MAX = 4

const option = computed(() => ({
  textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  tooltip: {
    trigger: 'item',
    appendTo: 'body',
    backgroundColor: CHART_TOOLTIP.backgroundColor,
    borderColor: CHART_TOOLTIP.borderColor,
    textStyle: { color: CHART_INK.primary }
  },
  radar: {
    indicator: props.axes.map(axis => ({ name: axis.label, max: AXIS_MAX, min: 0 })),
    shape: 'polygon',
    splitNumber: AXIS_MAX,
    axisName: { color: CHART_INK.secondary, fontSize: 13 },
    splitLine: { lineStyle: { color: CHART_INK.gridline } },
    splitArea: { show: false },
    axisLine: { lineStyle: { color: CHART_INK.baseline } }
  },
  series: [
    {
      type: 'radar',
      data: [
        {
          value: props.axes.map(axis => axis.value),
          name: '目前選擇的指標',
          lineStyle: { width: 2, color: CHART_ACCENT_GOLD },
          itemStyle: { color: CHART_ACCENT_GOLD },
          areaStyle: { color: CHART_ACCENT_GOLD, opacity: 0.25 }
        }
      ]
    }
  ]
}))
</script>

<template>
  <VChart class="radar-chart" :option="option" autoresize />
</template>

<style scoped>
.radar-chart {
  height: 360px;
  width: 100%;
}
</style>
