<script setup lang="ts">
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { InfoFilled } from '@element-plus/icons-vue'
import type { MetricsHistoryEntry } from '~/composables/stock/useMetricsHistory'

use([CanvasRenderer, LineChart, GridComponent, LegendComponent, TooltipComponent])

// 30-char strict cap (standing rule, see feedback_info_text_30_char_limit memory).
const INFO_TEXT = '資產負債表槓桿：負債比率／負債權益比'

// Card 2 of the 財務韌性/resilience family (design confirmed directly 2026-09-10) —
// debtRatio(%)/deRatio(倍), both Q-only balance-sheet snapshots, dual y-axis since units
// differ — same pattern as StockDividendCoverageChart.vue. Sibling
// StockDebtCoverageChart.vue covers the cash-flow angle (can the company actually service this
// leverage); this one is the balance-sheet structure itself. equityMultiplier (also resilience,
// also 倍/Q) is deliberately NOT repeated here — already shown on StockDupontChart.vue/
// StockRoeCompositionChart.vue.
const props = defineProps<{
  symbol: string
}>()

const METRIC_CODES = ['debtRatio', 'deRatio']

const symbolRef = computed(() => props.symbol)
const activeTab = ref<'近5年' | '近10年'>('近5年')
const limit = computed(() => (activeTab.value === '近5年' ? 20 : 40))

const history = useMetricsHistory(symbolRef, ref(METRIC_CODES), ref('Q'), limit)

const tenYearDisabled = computed(() => history.total.value !== null && history.total.value < 40)

interface Point {
  label: string
  debtRatio: number | null
  deRatio: number | null
}

function periodLabel(entry: { fiscalYear: number; fiscalQuarter: number }): string {
  return `${entry.fiscalYear} Q${entry.fiscalQuarter}`
}

const points = computed<Point[]>(() =>
  (history.data.value ?? []).map((entry: MetricsHistoryEntry) => ({
    label: periodLabel(entry),
    debtRatio: entry.values.debtRatio?.value ?? null,
    deRatio: entry.values.deRatio?.value ?? null
  }))
)

const hasAnyData = computed(() => points.value.some(point => point.debtRatio !== null || point.deRatio !== null))

const latestPoint = computed(() => {
  const list = points.value
  for (let i = list.length - 1; i >= 0; i--) {
    const point = list[i]!
    if (point.debtRatio !== null || point.deRatio !== null) return point
  }
  return null
})

// Same family visual language as StockDividendCoverageChart.vue — fixed colors, LIGHT variants
// darkened for WCAG 1.4.11's 3:1 non-text contrast.
const LEVERAGE_COLORS = {
  DARK: { debtRatio: '#5b8ff9', deRatio: '#eb9d6b' },
  LIGHT: { debtRatio: '#4984fd', deRatio: '#bc6527' }
}

const { resolvedMode } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))
const lineColors = computed(() => LEVERAGE_COLORS[resolvedMode.value])

interface AxisTooltipParam {
  dataIndex?: number
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
    textStyle: { color: chartInk.value.secondary, fontSize: 16 }
  },
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'line', lineStyle: { color: chartInk.value.baseline } },
    appendTo: 'body',
    backgroundColor: CHART_TOOLTIP.backgroundColor,
    borderColor: CHART_TOOLTIP.borderColor,
    textStyle: { color: CHART_TOOLTIP_INK.primary },
    formatter: (params: AxisTooltipParam | AxisTooltipParam[]) => {
      const list = Array.isArray(params) ? params : [params]
      const dataIndex = list[0]?.dataIndex ?? 0
      const point = points.value[dataIndex]
      if (!point) return ''
      const rowStyle = 'display:flex;justify-content:space-between;gap:16px;padding:2px 0;'
      const row = (label: string, value: number | null, unit: string) =>
        `<div style="${rowStyle}"><span>${label}</span><strong>${value !== null ? `${value.toFixed(2)}${unit}` : '資料不足'}</strong></div>`
      return `<div style="font-size:16px;min-width:170px;">
        <div style="font-weight:600;margin-bottom:4px;">${point.label}</div>
        ${row('負債比率', point.debtRatio, '%')}
        ${row('負債權益比', point.deRatio, '倍')}
      </div>`
    }
  },
  xAxis: {
    type: 'category',
    data: points.value.map(point => point.label),
    axisLine: { lineStyle: { color: chartInk.value.baseline } },
    axisTick: { show: false },
    axisLabel: { color: chartInk.value.muted, fontSize: 16 }
  },
  yAxis: [
    {
      type: 'value',
      name: '%',
      nameTextStyle: { color: chartInk.value.muted, fontSize: 16 },
      scale: true,
      splitLine: { lineStyle: { color: chartInk.value.gridline, type: 'solid' } },
      axisLabel: { color: chartInk.value.muted, fontSize: 16 }
    },
    {
      type: 'value',
      name: '倍',
      nameTextStyle: { color: chartInk.value.muted, fontSize: 16 },
      scale: true,
      splitLine: { show: false },
      axisLabel: { color: chartInk.value.muted, fontSize: 16 }
    }
  ],
  series: [
    {
      name: '負債比率',
      type: 'line',
      yAxisIndex: 0,
      showSymbol: true,
      symbolSize: 6,
      lineStyle: { width: 2.5, color: lineColors.value.debtRatio },
      itemStyle: { color: lineColors.value.debtRatio },
      data: points.value.map(point => point.debtRatio),
      z: 10
    },
    {
      name: '負債權益比',
      type: 'line',
      yAxisIndex: 1,
      showSymbol: true,
      symbolSize: 6,
      lineStyle: { width: 2, color: lineColors.value.deRatio },
      itemStyle: { color: lineColors.value.deRatio },
      data: points.value.map(point => point.deRatio)
    }
  ]
}))
</script>

<template>
  <el-card class="leverage-chart" shadow="never" :body-style="{ padding: '4px 4px 8px' }">
    <template #header>
      <div class="leverage-chart__header">
        <span class="leverage-chart__title">
          長期槓桿
          <el-tooltip :content="INFO_TEXT" placement="top" :popper-style="{ maxWidth: '280px' }">
            <el-icon class="leverage-chart__info"><InfoFilled /></el-icon>
          </el-tooltip>
        </span>
        <SharedLookbackWindowSelect v-model="activeTab" :ten-year-insufficient="tenYearDisabled" />
      </div>
    </template>

    <el-empty v-if="!history.pending.value && !hasAnyData" description="這檔股票尚無歷史資料，可能尚未排入資料回填" :image-size="64" />
    <template v-else>
      <VChart v-loading="history.pending.value" class="leverage-chart__chart" :option="option" autoresize />
      <SharedDataFreshnessNote source-label="公開發行公司財務報表" :as-of="latestPoint?.label ?? null" />
    </template>
  </el-card>
</template>

<style scoped>
.leverage-chart {
  border-radius: 12px;
}

.leverage-chart__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.leverage-chart__title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.leverage-chart__info {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  cursor: help;
}

.leverage-chart__chart {
  height: 260px;
  width: 100%;
}
</style>
