<script setup lang="ts">
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import type { MetricBasis, MetricCode } from '~/composables/stock/useMetricHistory'

use([CanvasRenderer, BarChart, LineChart, GridComponent, TooltipComponent])

// Shared by the three real charts bff-ts's GET /stocks/:symbol/metric-history now backs
// (confirmed live 2026-09-07): 本益比河流圖 (peRatio/TTM, line), 本淨比河流圖 (pbRatio/Q,
// line), 四季 EPS (eps/TTM, bar) — replacing StockChartShell placeholders for all three.
//
// NOT a real percentile-band "river" chart despite the 河流圖 label carried over from the
// existing STOCK_CARD_DEFS card name — analysis-ts's endpoint returns one value per period,
// not separate percentile-band boundaries, so this renders a single accurate line instead of
// inventing bands this app has no real data for. Deliberately not renamed here (that's a
// bigger product-naming call across STOCK_CARD_DEFS/dashboard than "wire up the real
// endpoint"), but worth revisiting if band data ever becomes available or the label should
// change to match what's actually shown.
//
// Old StockRiverChart.vue/StockEpsChart.vue deleted — both expected a mocked shape
// (ValuationBand/QuarterlyEpsPoint from useStockDetail.ts) no endpoint ever backed, and this
// one component now covers everything both of them tried to.
const props = defineProps<{
  symbol: string
  metricCode: MetricCode
  basis: MetricBasis
  title: string
  chartType: 'line' | 'bar'
  unit: string
}>()

const symbolRef = computed(() => props.symbol)
const metricCodeRef = computed(() => props.metricCode)
const basisRef = computed(() => props.basis)

// 近5年/近10年 lookback window, matching the multi-year convention this app already uses for
// financial-history charts (StockShareCapitalChart.vue, StockPeriodSelector's own MOPS-year
// range) and docs/investment-knowledge/基本面財報觀察年限分析.md's own argument for it — one
// period is one quarter, so 20/40 periods is exactly 5/10 years (40 is also
// metric-history's own documented limit ceiling).
const TAB_OPTIONS = ['近5年', '近10年'] as const
const activeTab = ref<(typeof TAB_OPTIONS)[number]>('近5年')
const limit = computed(() => (activeTab.value === '近5年' ? 20 : 40))

const { data: entries, pending } = useMetricHistory(symbolRef, metricCodeRef, basisRef, limit)

// A genuinely null value (nullReason: insufficient_history, etc.) stays null all the way into
// the chart series — ECharts leaves a real gap by default (connectNulls isn't set), rather
// than this component interpolating or zero-filling over it.
const hasAnyData = computed(() => !!entries.value?.some(entry => entry.value !== null))

function periodLabel(entry: { fiscalYear: number; fiscalQuarter: number }): string {
  return `${entry.fiscalYear} Q${entry.fiscalQuarter}`
}

function formatValue(value: number): string {
  return `${value.toFixed(2)}${props.unit}`
}

interface AxisTooltipParam {
  dataIndex?: number
  axisValueLabel?: string
}

const option = computed(() => ({
  textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  grid: { left: 8, right: 16, top: 16, bottom: 28, containLabel: true },
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: props.chartType === 'bar' ? 'shadow' : 'line', lineStyle: { color: CHART_INK.baseline } },
    appendTo: 'body',
    backgroundColor: CHART_TOOLTIP.backgroundColor,
    borderColor: CHART_TOOLTIP.borderColor,
    textStyle: { color: CHART_INK.primary },
    formatter: (params: AxisTooltipParam | AxisTooltipParam[]) => {
      const list = Array.isArray(params) ? params : [params]
      const dataIndex = list[0]?.dataIndex ?? 0
      const entry = entries.value?.[dataIndex]
      if (!entry) return ''
      const rowStyle = 'display:flex;justify-content:space-between;gap:16px;padding:2px 0;'
      const valueRow =
        entry.value !== null
          ? `<div style="${rowStyle}"><span>${props.title}</span><strong>${formatValue(entry.value)}</strong></div>`
          : `<div style="${rowStyle}color:${CHART_INK.secondary};"><span>${props.title}</span><strong>資料不足</strong></div>`
      return `<div style="font-size:12px;min-width:140px;"><div style="font-weight:600;margin-bottom:4px;">${periodLabel(entry)}</div>${valueRow}</div>`
    }
  },
  xAxis: {
    type: 'category',
    data: (entries.value ?? []).map(periodLabel),
    axisLine: { lineStyle: { color: CHART_INK.baseline } },
    axisTick: { show: false },
    axisLabel: { color: CHART_INK.muted, fontSize: 11 }
  },
  yAxis: {
    type: 'value',
    scale: true,
    splitLine: { lineStyle: { color: CHART_INK.gridline, type: 'solid' } },
    axisLabel: { color: CHART_INK.muted, fontSize: 11, formatter: `{value}${props.unit}` }
  },
  series: [
    props.chartType === 'bar'
      ? {
          type: 'bar',
          barMaxWidth: 24,
          itemStyle: { color: CHART_ACCENT_GOLD, borderRadius: [4, 4, 0, 0] },
          data: (entries.value ?? []).map(entry => entry.value)
        }
      : {
          type: 'line',
          showSymbol: false,
          smooth: true,
          smoothMonotone: 'x',
          lineStyle: { width: 2, color: CHART_ACCENT_GOLD },
          itemStyle: { color: CHART_ACCENT_GOLD },
          data: (entries.value ?? []).map(entry => entry.value)
        }
  ]
}))
</script>

<template>
  <el-card class="metric-history-chart" shadow="never" :body-style="{ padding: '4px 4px 8px' }">
    <template #header>
      <div class="metric-history-chart__header">
        <span class="metric-history-chart__title">{{ title }}</span>
        <div class="metric-history-chart__tabs">
          <button
            v-for="tab in TAB_OPTIONS"
            :key="tab"
            type="button"
            class="metric-history-chart__tab"
            :class="{ 'is-active': tab === activeTab }"
            @click="activeTab = tab"
          >{{ tab }}</button>
        </div>
      </div>
    </template>

    <el-empty v-if="!pending && !hasAnyData" description="這檔股票尚無歷史資料，可能尚未排入資料回填" :image-size="64" />
    <VChart v-else v-loading="pending" class="metric-history-chart__chart" :option="option" autoresize />
  </el-card>
</template>

<style scoped>
.metric-history-chart {
  border-radius: 12px;
}

.metric-history-chart__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.metric-history-chart__title {
  font-weight: 600;
}

.metric-history-chart__tabs {
  display: flex;
  gap: 4px;
}

.metric-history-chart__tab {
  padding: 2px 10px;
  border-radius: 6px;
  font-size: 16px;
  color: var(--el-text-color-secondary);
  border: 1px solid var(--el-border-color-lighter);
  background: transparent;
  cursor: pointer;
}

.metric-history-chart__tab.is-active {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

.metric-history-chart__chart {
  height: 240px;
  width: 100%;
}
</style>
