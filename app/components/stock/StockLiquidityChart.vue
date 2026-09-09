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
const INFO_TEXT = '短期償債能力：流動/速動/現金比率'

// Card 1 of the 財務韌性/resilience family (design confirmed directly 2026-09-10) — 流動比率/
// 速動比率/現金比率, all %, all Q-only (資產負債表時點快照, no TTM concept per each metric's
// own definition), same shared-axis line chart pattern as StockRoeCompositionChart.vue. The
// classic 短期償債能力三兄弟 — 流動比率 includes inventory, 速動比率 excludes it, 現金比率 only
// counts actual cash: reading all 3 together shows whether current-ratio strength is real
// liquid coverage or mostly illiquid inventory.
const props = defineProps<{
  symbol: string
}>()

const METRIC_CODES = ['currentRatio', 'quickRatio', 'cashRatio']

const symbolRef = computed(() => props.symbol)
const activeTab = ref<'近5年' | '近10年'>('近5年')
const limit = computed(() => (activeTab.value === '近5年' ? 20 : 40))

const history = useMetricsHistory(symbolRef, ref(METRIC_CODES), ref('Q'), limit)

const tenYearDisabled = computed(() => history.total.value !== null && history.total.value < 40)

interface Point {
  label: string
  currentRatio: number | null
  quickRatio: number | null
  cashRatio: number | null
}

function periodLabel(entry: { fiscalYear: number; fiscalQuarter: number }): string {
  return `${entry.fiscalYear} Q${entry.fiscalQuarter}`
}

const points = computed<Point[]>(() =>
  (history.data.value ?? []).map((entry: MetricsHistoryEntry) => ({
    label: periodLabel(entry),
    currentRatio: entry.values.currentRatio?.value ?? null,
    quickRatio: entry.values.quickRatio?.value ?? null,
    cashRatio: entry.values.cashRatio?.value ?? null
  }))
)

const hasAnyData = computed(() =>
  points.value.some(point => point.currentRatio !== null || point.quickRatio !== null || point.cashRatio !== null)
)

const latestPoint = computed(() => {
  const list = points.value
  for (let i = list.length - 1; i >= 0; i--) {
    const point = list[i]!
    if (point.currentRatio !== null || point.quickRatio !== null || point.cashRatio !== null) return point
  }
  return null
})

// Same family visual language as StockRoeCompositionChart.vue/StockMarginsChart.vue — fixed
// colors, LIGHT variants darkened for WCAG 1.4.11's 3:1 non-text contrast. Ordered widest→
// narrowest coverage (current→quick→cash) with decreasing line weight.
const LIQUIDITY_COLORS = {
  DARK: { currentRatio: '#d4a72c', quickRatio: '#5b8ff9', cashRatio: '#6bc99a' },
  LIGHT: { currentRatio: '#aa841f', quickRatio: '#4984fd', cashRatio: '#268a55' }
}

const { resolvedMode } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))
const lineColors = computed(() => LIQUIDITY_COLORS[resolvedMode.value])

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
        `<div style="${rowStyle}"><span>${label}</span><strong>${value !== null ? `${value.toFixed(2)}%` : '資料不足'}</strong></div>`
      return `<div style="font-size:16px;min-width:170px;">
        <div style="font-weight:600;margin-bottom:4px;">${point.label}</div>
        ${row('流動比率', point.currentRatio)}
        ${row('速動比率', point.quickRatio)}
        ${row('現金比率', point.cashRatio)}
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
    name: '%',
    nameTextStyle: { color: chartInk.value.muted, fontSize: 16 },
    scale: true,
    splitLine: { lineStyle: { color: chartInk.value.gridline, type: 'solid' } },
    axisLabel: { color: chartInk.value.muted, fontSize: 16 }
  },
  series: [
    {
      name: '流動比率',
      type: 'line',
      showSymbol: false,
      smooth: true,
      smoothMonotone: 'x',
      lineStyle: { width: 2.5, color: lineColors.value.currentRatio },
      itemStyle: { color: lineColors.value.currentRatio },
      data: points.value.map(point => point.currentRatio),
      z: 10
    },
    {
      name: '速動比率',
      type: 'line',
      showSymbol: false,
      smooth: true,
      smoothMonotone: 'x',
      lineStyle: { width: 2, color: lineColors.value.quickRatio },
      itemStyle: { color: lineColors.value.quickRatio },
      data: points.value.map(point => point.quickRatio)
    },
    {
      name: '現金比率',
      type: 'line',
      showSymbol: false,
      smooth: true,
      smoothMonotone: 'x',
      lineStyle: { width: 1.5, color: lineColors.value.cashRatio },
      itemStyle: { color: lineColors.value.cashRatio },
      data: points.value.map(point => point.cashRatio)
    }
  ]
}))
</script>

<template>
  <el-card class="liquidity-chart" shadow="never" :body-style="{ padding: '4px 4px 8px' }">
    <template #header>
      <div class="liquidity-chart__header">
        <span class="liquidity-chart__title">
          短期流動性
          <el-tooltip :content="INFO_TEXT" placement="top" :popper-style="{ maxWidth: '280px' }">
            <el-icon class="liquidity-chart__info"><InfoFilled /></el-icon>
          </el-tooltip>
        </span>
        <SharedLookbackWindowSelect v-model="activeTab" :ten-year-insufficient="tenYearDisabled" />
      </div>
    </template>

    <el-empty v-if="!history.pending.value && !hasAnyData" description="這檔股票尚無歷史資料，可能尚未排入資料回填" :image-size="64" />
    <template v-else>
      <VChart v-loading="history.pending.value" class="liquidity-chart__chart" :option="option" autoresize />
      <SharedDataFreshnessNote source-label="公開發行公司財務報表" :as-of="latestPoint?.label ?? null" />
    </template>
  </el-card>
</template>

<style scoped>
.liquidity-chart {
  border-radius: 12px;
}

.liquidity-chart__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.liquidity-chart__title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.liquidity-chart__info {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  cursor: help;
}

.liquidity-chart__chart {
  height: 260px;
  width: 100%;
}
</style>
