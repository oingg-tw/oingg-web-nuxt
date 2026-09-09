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
const INFO_TEXT = 'CCC = 存貨天數+收現天數-付現天數'

// Card 2 of the 營運周轉 family (design confirmed directly 2026-09-10) — inventoryDays(DIO)/
// receivablesDays(DSO)/payablesDays(DPO)/cashConversionCycle(CCC), all 天/TTM — the classic
// cash-conversion-cycle chart, and the DAYS-shaped counterpart to sibling
// StockTurnoverRatioChart.vue's own TIMES-PER-YEAR view of the same 3 underlying flows (CCC
// itself, per analysis-ts's own definition, IS DIO+DSO−DPO — shown together so the reader can
// see the 3 components and the composite in one place instead of doing the arithmetic
// themselves).
const props = defineProps<{
  symbol: string
}>()

const METRIC_CODES = ['inventoryDays', 'receivablesDays', 'payablesDays', 'cashConversionCycle']

const symbolRef = computed(() => props.symbol)
const activeTab = ref<'近5年' | '近10年'>('近5年')
const limit = computed(() => (activeTab.value === '近5年' ? 20 : 40))

const history = useMetricsHistory(symbolRef, ref(METRIC_CODES), ref('TTM'), limit)

const tenYearDisabled = computed(() => history.total.value !== null && history.total.value < 40)

interface Point {
  label: string
  inventoryDays: number | null
  receivablesDays: number | null
  payablesDays: number | null
  cashConversionCycle: number | null
}

function periodLabel(entry: { fiscalYear: number; fiscalQuarter: number }): string {
  return `${entry.fiscalYear} Q${entry.fiscalQuarter}`
}

const points = computed<Point[]>(() =>
  (history.data.value ?? []).map((entry: MetricsHistoryEntry) => ({
    label: periodLabel(entry),
    inventoryDays: entry.values.inventoryDays?.value ?? null,
    receivablesDays: entry.values.receivablesDays?.value ?? null,
    payablesDays: entry.values.payablesDays?.value ?? null,
    cashConversionCycle: entry.values.cashConversionCycle?.value ?? null
  }))
)

const hasAnyData = computed(() =>
  points.value.some(
    point => point.inventoryDays !== null || point.receivablesDays !== null || point.payablesDays !== null || point.cashConversionCycle !== null
  )
)

const latestPoint = computed(() => {
  const list = points.value
  for (let i = list.length - 1; i >= 0; i--) {
    const point = list[i]!
    if (point.inventoryDays !== null || point.receivablesDays !== null || point.payablesDays !== null || point.cashConversionCycle !== null)
      return point
  }
  return null
})

// Same family visual language as sibling cards — fixed colors, LIGHT variants darkened for
// WCAG 1.4.11's 3:1 non-text contrast. CCC (the composite) gets the heaviest line/highest z per
// this card family's own "primary metric stands out" convention.
const CCC_COLORS = {
  DARK: { inventoryDays: '#d4a72c', receivablesDays: '#5b8ff9', payablesDays: '#6bc99a', cashConversionCycle: '#c792ea' },
  LIGHT: { inventoryDays: '#aa841f', receivablesDays: '#4984fd', payablesDays: '#268a55', cashConversionCycle: '#b368e5' }
}

const { resolvedMode } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))
const lineColors = computed(() => CCC_COLORS[resolvedMode.value])

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
        `<div style="${rowStyle}"><span>${label}</span><strong>${value !== null ? `${value.toFixed(1)} 天` : '資料不足'}</strong></div>`
      return `<div style="font-size:16px;min-width:190px;">
        <div style="font-weight:600;margin-bottom:4px;">${point.label}</div>
        ${row('存貨週轉天數 (DIO)', point.inventoryDays)}
        ${row('應收帳款收現天數 (DSO)', point.receivablesDays)}
        ${row('應付帳款付現天數 (DPO)', point.payablesDays)}
        ${row('現金轉換循環 (CCC)', point.cashConversionCycle)}
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
    name: '天',
    nameTextStyle: { color: chartInk.value.muted, fontSize: 16 },
    scale: true,
    splitLine: { lineStyle: { color: chartInk.value.gridline, type: 'solid' } },
    axisLabel: { color: chartInk.value.muted, fontSize: 16 }
  },
  series: [
    {
      name: '存貨週轉天數 (DIO)',
      type: 'line',
      showSymbol: true,
      symbolSize: 6,
      lineStyle: { width: 2, color: lineColors.value.inventoryDays },
      itemStyle: { color: lineColors.value.inventoryDays },
      data: points.value.map(point => point.inventoryDays)
    },
    {
      name: '應收帳款收現天數 (DSO)',
      type: 'line',
      showSymbol: true,
      symbolSize: 6,
      lineStyle: { width: 2, color: lineColors.value.receivablesDays },
      itemStyle: { color: lineColors.value.receivablesDays },
      data: points.value.map(point => point.receivablesDays)
    },
    {
      name: '應付帳款付現天數 (DPO)',
      type: 'line',
      showSymbol: true,
      symbolSize: 6,
      lineStyle: { width: 2, color: lineColors.value.payablesDays },
      itemStyle: { color: lineColors.value.payablesDays },
      data: points.value.map(point => point.payablesDays)
    },
    {
      name: '現金轉換循環 (CCC)',
      type: 'line',
      showSymbol: true,
      symbolSize: 6,
      lineStyle: { width: 2.5, color: lineColors.value.cashConversionCycle },
      itemStyle: { color: lineColors.value.cashConversionCycle },
      data: points.value.map(point => point.cashConversionCycle),
      z: 10
    }
  ]
}))
</script>

<template>
  <el-card class="cash-conversion-cycle-chart" shadow="never" :body-style="{ padding: '4px 4px 8px' }">
    <template #header>
      <div class="cash-conversion-cycle-chart__header">
        <span class="cash-conversion-cycle-chart__title">
          現金轉換循環 (CCC)
          <el-tooltip :content="INFO_TEXT" placement="top" :popper-style="{ maxWidth: '280px' }">
            <el-icon class="cash-conversion-cycle-chart__info"><InfoFilled /></el-icon>
          </el-tooltip>
        </span>
        <SharedLookbackWindowSelect v-model="activeTab" :ten-year-insufficient="tenYearDisabled" />
      </div>
    </template>

    <el-empty v-if="!history.pending.value && !hasAnyData" description="這檔股票尚無歷史資料，可能尚未排入資料回填" :image-size="64" />
    <template v-else>
      <VChart v-loading="history.pending.value" class="cash-conversion-cycle-chart__chart" :option="option" autoresize />
      <SharedDataFreshnessNote source-label="公開發行公司財務報表" :as-of="latestPoint?.label ?? null" />
    </template>
  </el-card>
</template>

<style scoped>
.cash-conversion-cycle-chart {
  border-radius: 12px;
}

.cash-conversion-cycle-chart__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.cash-conversion-cycle-chart__title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.cash-conversion-cycle-chart__info {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  cursor: help;
}

.cash-conversion-cycle-chart__chart {
  height: 260px;
  width: 100%;
}
</style>
