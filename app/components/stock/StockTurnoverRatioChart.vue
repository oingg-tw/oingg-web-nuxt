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
const INFO_TEXT = '存貨/應收/應付週轉率，同軸比較'

// Card 1 of the 營運周轉 family (design confirmed directly 2026-09-10, analysis-ts's own
// domainPitMetrics/efficiency) — inventoryTurnover/receivablesTurnover/payablesTurnover, all
// 次/TTM, same shared-axis pattern as StockMarginsChart.vue. Companion to sibling
// StockCashConversionCycleChart.vue (the same 3 underlying flows expressed as DAYS instead of
// TIMES-PER-YEAR — kept as a separate card since 次 and 天 don't share an axis).
const props = defineProps<{
  symbol: string
}>()

const METRIC_CODES = ['inventoryTurnover', 'receivablesTurnover', 'payablesTurnover']

const symbolRef = computed(() => props.symbol)
const activeTab = ref<'近5年' | '近10年'>('近5年')
const limit = computed(() => (activeTab.value === '近5年' ? 20 : 40))

const history = useMetricsHistory(symbolRef, ref(METRIC_CODES), ref('TTM'), limit)

const tenYearDisabled = computed(() => history.total.value !== null && history.total.value < 40)

interface Point {
  label: string
  inventoryTurnover: number | null
  receivablesTurnover: number | null
  payablesTurnover: number | null
}

function periodLabel(entry: { fiscalYear: number; fiscalQuarter: number }): string {
  return `${entry.fiscalYear} Q${entry.fiscalQuarter}`
}

const points = computed<Point[]>(() =>
  (history.data.value ?? []).map((entry: MetricsHistoryEntry) => ({
    label: periodLabel(entry),
    inventoryTurnover: entry.values.inventoryTurnover?.value ?? null,
    receivablesTurnover: entry.values.receivablesTurnover?.value ?? null,
    payablesTurnover: entry.values.payablesTurnover?.value ?? null
  }))
)

const hasAnyData = computed(() =>
  points.value.some(point => point.inventoryTurnover !== null || point.receivablesTurnover !== null || point.payablesTurnover !== null)
)

const latestPoint = computed(() => {
  const list = points.value
  for (let i = list.length - 1; i >= 0; i--) {
    const point = list[i]!
    if (point.inventoryTurnover !== null || point.receivablesTurnover !== null || point.payablesTurnover !== null) return point
  }
  return null
})

// Same family visual language as StockMarginsChart.vue — fixed colors, LIGHT variants darkened
// for WCAG 1.4.11's 3:1 non-text contrast.
const TURNOVER_COLORS = {
  DARK: { inventoryTurnover: '#d4a72c', receivablesTurnover: '#5b8ff9', payablesTurnover: '#6bc99a' },
  LIGHT: { inventoryTurnover: '#aa841f', receivablesTurnover: '#4984fd', payablesTurnover: '#268a55' }
}

const { resolvedMode } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))
const lineColors = computed(() => TURNOVER_COLORS[resolvedMode.value])

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
      const row = (label: string, value: number | null) =>
        `<div style="${rowStyle}"><span>${label}</span><strong>${value !== null ? `${value.toFixed(2)} 次` : '資料不足'}</strong></div>`
      return `<div style="font-size:16px;min-width:170px;">
        <div style="font-weight:600;margin-bottom:4px;">${point.label}</div>
        ${row('存貨週轉率', point.inventoryTurnover)}
        ${row('應收帳款週轉率', point.receivablesTurnover)}
        ${row('應付帳款週轉率', point.payablesTurnover)}
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
  yAxis: {
    type: 'value',
    name: '次',
    nameTextStyle: { color: chartInk.value.muted, fontSize: 16 },
    scale: true,
    splitLine: { lineStyle: { color: chartInk.value.gridline, type: 'solid' } },
    axisLabel: { color: chartInk.value.muted, fontSize: 16 }
  },
  series: [
    {
      name: '存貨週轉率',
      type: 'line',
      showSymbol: true,
      symbolSize: 6,
      lineStyle: { width: 2.5, color: lineColors.value.inventoryTurnover },
      itemStyle: { color: lineColors.value.inventoryTurnover },
      data: points.value.map(point => point.inventoryTurnover),
      z: 10
    },
    {
      name: '應收帳款週轉率',
      type: 'line',
      showSymbol: true,
      symbolSize: 6,
      lineStyle: { width: 2, color: lineColors.value.receivablesTurnover },
      itemStyle: { color: lineColors.value.receivablesTurnover },
      data: points.value.map(point => point.receivablesTurnover)
    },
    {
      name: '應付帳款週轉率',
      type: 'line',
      showSymbol: true,
      symbolSize: 6,
      lineStyle: { width: 2, color: lineColors.value.payablesTurnover },
      itemStyle: { color: lineColors.value.payablesTurnover },
      data: points.value.map(point => point.payablesTurnover)
    }
  ]
}))
</script>

<template>
  <el-card class="turnover-ratio-chart" shadow="never" :body-style="{ padding: '4px 4px 8px' }">
    <template #header>
      <div class="turnover-ratio-chart__header">
        <span class="turnover-ratio-chart__title">
          存貨／應收／應付週轉率
          <el-tooltip :content="INFO_TEXT" placement="top" :popper-style="{ maxWidth: '280px' }">
            <el-icon class="turnover-ratio-chart__info"><InfoFilled /></el-icon>
          </el-tooltip>
        </span>
        <SharedLookbackWindowSelect v-model="activeTab" :ten-year-insufficient="tenYearDisabled" />
      </div>
    </template>

    <el-empty v-if="!history.pending.value && !hasAnyData" description="這檔股票尚無歷史資料，可能尚未排入資料回填" :image-size="64" />
    <template v-else>
      <VChart v-loading="history.pending.value" class="turnover-ratio-chart__chart" :option="option" autoresize />
      <SharedDataFreshnessNote source-label="公開發行公司財務報表" :as-of="latestPoint?.label ?? null" />
    </template>
  </el-card>
</template>

<style scoped>
.turnover-ratio-chart {
  border-radius: 12px;
}

.turnover-ratio-chart__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.turnover-ratio-chart__title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.turnover-ratio-chart__info {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  cursor: help;
}

.turnover-ratio-chart__chart {
  height: 260px;
  width: 100%;
}
</style>
