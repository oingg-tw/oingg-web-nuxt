<script setup lang="ts">
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'

use([CanvasRenderer, BarChart, GridComponent, TooltipComponent])

const props = defineProps<{
  quarters: { quarter: string; eps: number }[]
}>()

const option = computed(() => ({
  textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  grid: { left: 8, right: 16, top: 24, bottom: 28, containLabel: true },
  tooltip: {
    trigger: 'item',
    formatter: (params: { name: string; value: number }) =>
      `${params.name}<br/><strong>${params.value.toFixed(2)}</strong> 元`,
    textStyle: { color: CHART_INK.primary }
  },
  xAxis: {
    type: 'category',
    data: props.quarters.map(q => q.quarter),
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
    {
      type: 'bar',
      barMaxWidth: 24,
      data: props.quarters.map((q, index) => {
        const isLoss = q.eps < 0
        const isLatest = index === props.quarters.length - 1
        return {
          value: q.eps,
          itemStyle: {
            color: isLoss ? CHART_DIVERGING.negative : CHART_DIVERGING.positive,
            borderRadius: isLoss ? [0, 0, 4, 4] : [4, 4, 0, 0]
          },
          label: {
            show: isLoss || isLatest,
            position: isLoss ? 'bottom' : 'top',
            color: CHART_INK.secondary,
            fontSize: 11,
            formatter: () => q.eps.toFixed(2)
          }
        }
      })
    }
  ]
}))
</script>

<template>
  <el-card class="eps-card" shadow="never" :body-style="{ padding: '4px 4px 8px' }">
    <template #header>
      <span class="eps-card__title">每季 EPS</span>
    </template>
    <VChart class="eps-card__chart" :option="option" autoresize />
  </el-card>
</template>

<style scoped>
.eps-card {
  border-radius: 12px;
}

.eps-card__title {
  font-weight: 600;
}

.eps-card__chart {
  height: 240px;
  width: 100%;
}
</style>
