<script setup lang="ts">
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import type { QuarterlyEpsPoint } from '~/composables/useStockDetail'

use([CanvasRenderer, BarChart, GridComponent, TooltipComponent])

const props = defineProps<{
  quarters: QuarterlyEpsPoint[]
}>()

const mode = ref<'quarterly' | 'ttm'>('quarterly')

const values = computed(() => props.quarters.map(q => (mode.value === 'ttm' ? q.ttmEps : q.eps)))

const option = computed(() => ({
  textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  grid: { left: 8, right: 16, top: 24, bottom: 28, containLabel: true },
  tooltip: {
    trigger: 'item',
    appendTo: 'body',
    formatter: (params: { name: string; value: number }) =>
      `${params.name}<br/><strong>${params.value.toFixed(2)}</strong> 元`,
    backgroundColor: CHART_TOOLTIP.backgroundColor,
    borderColor: CHART_TOOLTIP.borderColor,
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
      data: values.value.map(value => {
        const isLoss = value < 0
        return {
          value,
          itemStyle: {
            color: isLoss ? CHART_DIVERGING.negative : CHART_DIVERGING.positive,
            borderRadius: isLoss ? [0, 0, 4, 4] : [4, 4, 0, 0]
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
      <div class="eps-card__header">
        <span class="eps-card__title">每股盈餘</span>
        <el-radio-group v-model="mode" size="small">
          <el-radio-button value="quarterly">單季</el-radio-button>
          <el-radio-button value="ttm">近四季</el-radio-button>
        </el-radio-group>
      </div>
    </template>
    <VChart class="eps-card__chart" :option="option" autoresize />
  </el-card>
</template>

<style scoped>
.eps-card {
  border-radius: 12px;
}

.eps-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.eps-card__title {
  font-weight: 600;
}

.eps-card__chart {
  height: 240px;
  width: 100%;
}
</style>
