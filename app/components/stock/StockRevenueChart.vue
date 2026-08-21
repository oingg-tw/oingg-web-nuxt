<script setup lang="ts">
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import type { MonthlyRevenue } from '~/composables/useStockDetail'

use([CanvasRenderer, BarChart, LineChart, GridComponent, LegendComponent, TooltipComponent])

const props = defineProps<{
  months: MonthlyRevenue[]
}>()

interface AxisTooltipParam {
  dataIndex?: number
  axisValueLabel?: string
}

const option = computed(() => ({
  textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  grid: { left: 8, right: 8, top: 36, bottom: 28, containLabel: true },
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
    formatter: (params: AxisTooltipParam | AxisTooltipParam[]) => {
      const list = Array.isArray(params) ? params : [params]
      const dataIndex = list[0]?.dataIndex ?? 0
      const axisLabel = list[0]?.axisValueLabel ?? ''
      const month = props.months[dataIndex]!
      const sign = month.yoy > 0 ? '+' : ''
      const rowStyle = 'display:flex;justify-content:space-between;gap:16px;padding:2px 0;'
      return `<div style="font-size:12px;min-width:130px;">
        <div style="font-weight:600;margin-bottom:4px;">${axisLabel}</div>
        <div style="${rowStyle}"><span>營收</span><strong>${month.revenue.toFixed(1)} 億元</strong></div>
        <div style="${rowStyle}"><span>年增率</span><strong>${sign}${month.yoy.toFixed(1)}%</strong></div>
      </div>`
    }
  },
  xAxis: {
    type: 'category',
    data: props.months.map(m => m.month),
    axisLine: { lineStyle: { color: CHART_INK.baseline } },
    axisTick: { show: false },
    axisLabel: { color: CHART_INK.muted, fontSize: 11 }
  },
  yAxis: [
    {
      type: 'value',
      name: '億元',
      nameTextStyle: { color: CHART_INK.muted, fontSize: 11 },
      scale: true,
      splitLine: { lineStyle: { color: CHART_INK.gridline, type: 'solid' } },
      axisLabel: { color: CHART_INK.muted, fontSize: 11 }
    },
    {
      type: 'value',
      name: '年增率 %',
      nameTextStyle: { color: CHART_INK.muted, fontSize: 11 },
      scale: true,
      splitLine: { show: false },
      axisLabel: { color: CHART_INK.muted, fontSize: 11, formatter: '{value}%' }
    }
  ],
  series: [
    {
      name: '月營收',
      type: 'bar',
      yAxisIndex: 0,
      barMaxWidth: 24,
      itemStyle: { color: CHART_ACCENT_GOLD, borderRadius: [4, 4, 0, 0] },
      data: props.months.map(m => m.revenue)
    },
    {
      name: '年增率',
      type: 'line',
      yAxisIndex: 1,
      showSymbol: false,
      smooth: true,
      smoothMonotone: 'x',
      lineStyle: { width: 2, color: CHART_INK.primary },
      itemStyle: { color: CHART_INK.primary },
      markLine: {
        symbol: 'none',
        silent: true,
        label: { show: false },
        lineStyle: { color: CHART_INK.baseline, type: 'dashed', width: 1 },
        data: [{ yAxis: 0 }]
      },
      data: props.months.map(m => m.yoy),
      z: 10
    }
  ]
}))
</script>

<template>
  <el-card class="revenue-card" shadow="never" :body-style="{ padding: '4px 4px 8px' }">
    <template #header>
      <span class="revenue-card__title">月營收與年增率</span>
    </template>
    <VChart class="revenue-card__chart" :option="option" autoresize />
  </el-card>
</template>

<style scoped>
.revenue-card {
  border-radius: 12px;
}

.revenue-card__title {
  font-weight: 600;
}

.revenue-card__chart {
  height: 240px;
  width: 100%;
}
</style>
