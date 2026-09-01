<script setup lang="ts">
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import type { ValuationBand } from '~/composables/stock/useStockDetail'

use([CanvasRenderer, LineChart, GridComponent, LegendComponent, TooltipComponent])

const props = defineProps<{
  title: string
  quarters: string[]
  price: number[]
  bands: ValuationBand[] // ascending: lowest multiple -> highest multiple
}>()

// Line/fill colors now follow the user's own price-up/down convention (see
// chart-palette.ts's riverColors) instead of a fixed red-high/green-low pair — highest
// multiple gets the "up" color, lowest gets "down", so this flips right along with every
// other up/down color in the app when the user picks WESTERN or ACCESSIBLE.
const { resolvedMode, market } = useAppTheme()
const riverPalette = computed(() => {
  const { up, down } = getPriceColors(resolvedMode.value, market.value)
  return riverColors(up, down)
})

interface AxisTooltipParam {
  dataIndex?: number
  axisValueLabel?: string
}

const option = computed(() => ({
  textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  grid: { left: 8, right: 16, top: 36, bottom: 28, containLabel: true },
  legend: {
    top: 0,
    left: 0,
    icon: 'roundRect',
    itemWidth: 12,
    itemHeight: 3,
    textStyle: { color: CHART_INK.secondary, fontSize: 12 }
  },
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'line', lineStyle: { color: CHART_INK.baseline } },
    appendTo: 'body',
    backgroundColor: CHART_TOOLTIP.backgroundColor,
    borderColor: CHART_TOOLTIP.borderColor,
    textStyle: { color: CHART_INK.primary },
    // Series are stacked so the fills render between adjacent lines; that makes each
    // series' raw value the *segment* delta, not the boundary itself, so the default
    // tooltip would show the wrong numbers — read the real boundary/price values instead.
    formatter: (params: AxisTooltipParam | AxisTooltipParam[]) => {
      const list = Array.isArray(params) ? params : [params]
      const dataIndex = list[0]?.dataIndex ?? 0
      const axisLabel = list[0]?.axisValueLabel ?? ''
      const rowStyle = 'display:flex;justify-content:space-between;gap:16px;padding:2px 0;'
      const bandRows = props.bands
        .map((band, i) => ({ band, color: riverPalette.value.lines[i] }))
        .reverse()
        .map(
          ({ band, color }) =>
            `<div style="${rowStyle}"><span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:6px;"></span>${band.label}</span><strong>${band.values[dataIndex]!.toFixed(2)}</strong></div>`
        )
        .join('')
      const priceRow = `<div style="${rowStyle}font-weight:600;border-top:1px solid ${CHART_TOOLTIP.borderColor};margin-top:2px;padding-top:4px;"><span>股價</span><strong>${props.price[dataIndex]!.toFixed(2)}</strong></div>`
      return `<div style="font-size:12px;min-width:140px;"><div style="font-weight:600;margin-bottom:4px;">${axisLabel}</div>${bandRows}${priceRow}</div>`
    }
  },
  xAxis: {
    type: 'category',
    data: props.quarters,
    boundaryGap: false,
    axisLine: { lineStyle: { color: CHART_INK.baseline } },
    axisTick: { show: false },
    axisLabel: { color: CHART_INK.muted, fontSize: 11 }
  },
  yAxis: {
    type: 'value',
    scale: true,
    splitLine: { lineStyle: { color: CHART_INK.gridline, type: 'solid' } },
    axisLabel: { color: CHART_INK.muted, fontSize: 11 }
  },
  series: [
    ...props.bands.map((band, i) => {
      const previous = props.bands[i - 1]
      const data = previous ? band.values.map((v, idx) => v - previous.values[idx]!) : band.values
      return {
        name: band.label,
        type: 'line',
        data,
        stack: 'river',
        showSymbol: false,
        smooth: true,
        smoothMonotone: 'x',
        lineStyle: { width: 1.5, color: riverPalette.value.lines[i] },
        itemStyle: { color: riverPalette.value.lines[i] },
        ...(previous ? { areaStyle: { color: riverPalette.value.fills[i - 1], opacity: 0.5 } } : {}),
        z: 2
      }
    }),
    {
      name: '股價',
      type: 'line',
      data: props.price,
      showSymbol: false,
      smooth: true,
      smoothMonotone: 'x',
      lineStyle: { width: 2.5, color: CHART_INK.primary },
      itemStyle: { color: CHART_INK.primary },
      z: 10
    }
  ]
}))
</script>

<template>
  <el-card class="river-card" shadow="never" :body-style="{ padding: '4px 4px 8px' }">
    <template #header>
      <span class="river-card__title">{{ title }}</span>
    </template>
    <VChart class="river-card__chart" :option="option" autoresize />
  </el-card>
</template>

<style scoped>
.river-card {
  border-radius: 12px;
}

.river-card__title {
  font-weight: 600;
}

.river-card__chart {
  height: 280px;
  width: 100%;
}
</style>
