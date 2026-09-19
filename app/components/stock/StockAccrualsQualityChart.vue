<script setup lang="ts">
import type { LookbackWindow } from '~/utils/lookback-window'
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import type { MetricsHistoryEntry } from '~/composables/stock/useMetricsHistory'

use([SVGRenderer, LineChart, GridComponent, LegendComponent, TooltipComponent])

// 30-char strict cap (standing rule, see feedback_info_text_30_char_limit memory).
const INFO_TEXT = '帳面獲利有沒有真現金流撐著'

// Card 2 of the 獲利品質/quality (cash-earnings) family (design confirmed directly 2026-09-09) —
// accrualsRatio(%)/ocfToNetIncome(倍) are two sides of the SAME question (accruals = net income
// − operating cash flow; ocfToNetIncome = operating cash flow ÷ net income), kept as their own
// card separate from StockCashEarningsChart.vue's per-share family since the units don't match
// (%/倍 vs 元) — dual y-axis, same pattern as StockDividendCoverageChart.vue. A LOW accruals
// ratio + a HIGH ocfToNetIncome together read as "profit is cash-backed, not accrual-heavy";
// the two moving in opposite directions (ratio up, ocf/NI down) is the earnings-quality warning
// sign this card exists to surface.
const props = defineProps<{
  symbol: string
}>()

const METRIC_CODES = ['accrualsRatio', 'ocfToNetIncome']

const symbolRef = computed(() => props.symbol)
const activeTab = ref<LookbackWindow>('近5年')
const limit = computed(() => LOOKBACK_WINDOW_YEARS[activeTab.value] * 4)

// Timeframe flipped TTM→Q 2026-09-14 per direct request across all cards ("針對所有卡片，都先幫我
// 改成單季呈現或是預設單季") — TTM/近四季 is a multi-quarter rolling aggregate that can't map
// back to one single filed disclosure for 稽核鏈 purposes ("因為要落實稽核鍊就不可能總是呈現
// 近四季給用戶"); both accrualsRatio/ocfToNetIncome have a real 'Q' field (confirmed via
// GET /metrics), so this reads real single-quarter figures now.
const history = useMetricsHistory(symbolRef, ref(METRIC_CODES), ref('Q'), limit)

const disabledYears = computed(() =>
  LOOKBACK_YEARS.filter(years => history.total.value !== null && history.total.value! < years * 4)
)

interface Point {
  label: string
  accrualsRatio: number | null
  ocfToNetIncome: number | null
}

function periodLabel(entry: { fiscalYear: number; fiscalQuarter: number }): string {
  return `${entry.fiscalYear} Q${entry.fiscalQuarter}`
}

const points = computed<Point[]>(() =>
  (history.data.value ?? []).map((entry: MetricsHistoryEntry) => ({
    label: periodLabel(entry),
    accrualsRatio: entry.values.accrualsRatio?.value ?? null,
    ocfToNetIncome: entry.values.ocfToNetIncome?.value ?? null
  }))
)

const hasAnyData = computed(() => points.value.some(point => point.accrualsRatio !== null || point.ocfToNetIncome !== null))

const latestPoint = computed(() => {
  const list = points.value
  for (let i = list.length - 1; i >= 0; i--) {
    const point = list[i]!
    if (point.accrualsRatio !== null || point.ocfToNetIncome !== null) return point
  }
  return null
})

// Same family visual language as StockDividendCoverageChart.vue — fixed (not theme-accent-
// linked) colors, LIGHT variants darkened for WCAG 1.4.11's 3:1 non-text contrast.
const ACCRUALS_QUALITY_COLORS = {
  DARK: { accrualsRatio: '#ee9baa', ocfToNetIncome: '#5b8ff9' },
  LIGHT: { accrualsRatio: '#c23a5e', ocfToNetIncome: '#4984fd' }
}

const { resolvedMode } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))
const lineColors = computed(() => ACCRUALS_QUALITY_COLORS[resolvedMode.value])

interface AxisTooltipParam {
  dataIndex?: number
}

const option = computed(() => ({
  textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  grid: { left: 8, right: 8, top: 60, bottom: 28, containLabel: true },
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
      return `<div style="font-size: 1rem;min-width:180px;">
        <div style="font-weight:600;margin-bottom:4px;">${point.label}</div>
        ${row('應計項目比率', point.accrualsRatio, '%')}
        ${row('營業現金流對淨利比', point.ocfToNetIncome, '倍')}
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
      name: '應計項目比率',
      type: 'line',
      yAxisIndex: 0,
      showSymbol: true,
      symbolSize: 6,
      lineStyle: { width: 2.5, color: lineColors.value.accrualsRatio },
      itemStyle: { color: lineColors.value.accrualsRatio },
      data: points.value.map(point => point.accrualsRatio),
      z: 10
    },
    {
      name: '營業現金流對淨利比',
      type: 'line',
      yAxisIndex: 1,
      showSymbol: true,
      symbolSize: 6,
      lineStyle: { width: 2, color: lineColors.value.ocfToNetIncome },
      itemStyle: { color: lineColors.value.ocfToNetIncome },
      data: points.value.map(point => point.ocfToNetIncome)
    }
  ]
}))
</script>

<template>
  <el-card class="accruals-quality-chart" shadow="never" :body-style="{ padding: '4px 4px 8px' }">
    <template #header>
      <div class="accruals-quality-chart__header">
        <StockCardTitle title="應計品質" :info-text="INFO_TEXT" metric-code="accrualsRatio" />
        <SharedLookbackWindowSelect v-model="activeTab" :disabled-years="disabledYears" />
      </div>
    </template>

    <SharedEmptyState v-if="!history.pending.value && !hasAnyData" description="這檔股票尚無歷史資料，可能尚未排入資料回填" />
    <template v-else>
      <SharedChart v-loading="history.pending.value" class="accruals-quality-chart__chart" :option="option" :init-options="{ renderer: 'svg' }" autoresize />
      <SharedDataFreshnessNote source-label="公開發行公司財務報表" :as-of="latestPoint?.label ?? null" />
    </template>
  </el-card>
</template>

<style scoped>
.accruals-quality-chart {
  border-radius: 12px;
}

.accruals-quality-chart__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.accruals-quality-chart__chart {
  height: 16.25rem;
  width: 100%;
}
</style>
