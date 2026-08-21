<script setup lang="ts">
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import type { ValuationBand } from '~/composables/useStockDetail'

use([CanvasRenderer, LineChart, GridComponent, LegendComponent, TooltipComponent])

const props = defineProps<{
  title: string
  subtitle?: string
  quarters: string[]
  price: number[]
  bands: ValuationBand[]
}>()

const option = computed(() => ({
  color: CHART_SEQUENTIAL_BLUE,
  textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  grid: { left: 8, right: 64, top: 36, bottom: 28, containLabel: true },
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
    valueFormatter: (value: number) => value.toFixed(2),
    textStyle: { color: CHART_INK.primary }
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
    ...props.bands.map(band => ({
      name: band.label,
      type: 'line',
      data: band.values,
      showSymbol: false,
      smooth: true,
      smoothMonotone: 'x',
      lineStyle: { width: 1.5 },
      z: 2
    })),
    {
      name: '股價',
      type: 'line',
      data: props.price,
      showSymbol: false,
      smooth: true,
      smoothMonotone: 'x',
      lineStyle: { width: 2.5, color: CHART_INK.primary },
      itemStyle: { color: CHART_INK.primary },
      endLabel: {
        show: true,
        formatter: '{c}',
        color: CHART_INK.primary,
        fontWeight: 600,
        fontSize: 12
      },
      z: 10
    }
  ]
}))
</script>

<template>
  <el-card class="river-card" shadow="never">
    <template #header>
      <div class="river-card__header">
        <span class="river-card__title">{{ title }}</span>
        <span v-if="subtitle" class="river-card__subtitle">{{ subtitle }}</span>
      </div>
    </template>
    <VChart class="river-card__chart" :option="option" autoresize />
  </el-card>
</template>

<style scoped>
.river-card {
  border-radius: 12px;
}

.river-card__header {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px;
}

.river-card__title {
  font-weight: 600;
}

.river-card__subtitle {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.river-card__chart {
  height: 280px;
  width: 100%;
}
</style>
