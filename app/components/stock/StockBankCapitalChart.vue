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
const INFO_TEXT = '銀行/金控專屬：資本適足與資產品質'

// Card 4 of the 財務韌性/resilience family (design confirmed directly 2026-09-10) — bank/
// financial-holding-only metrics (逾放比率/備抵呆帳覆蓋率/資本適足率/CET1/Tier1), all %, all Q.
// Deliberately NOT built for every stock the way the other 3 resilience cards are: analysis-ts's
// own definitions confirm coverage is genuinely narrow (逾放比率 ~19-20 banks, CAR/CET1/Tier1
// only ~6-7 with data, and only Q2/Q4 — supervisory disclosure is semi-annual, Q1/Q3 are a real
// "not disclosed this quarter," not a data gap). Confirmed live against 2801 (彰銀): CAR/CET1/
// Tier1 sit in the same ~10-15% band, 逾放比率 is a much smaller ~0.15%, and 備抵呆帳覆蓋率 is
// two orders of magnitude larger (~800-900%, a coverage RATIO by design, not a comparable
// percentage) — dual y-axis to keep coverage from flattening the other 4 lines to the baseline.
// Every non-bank symbol just shows this card's own empty state (missing_input on all 5 codes,
// same "optimistic fetch, graceful empty" pattern as StockForeignShareholdingChart.vue's own
// narrow-coverage precedent), not a conditional hide — no "is this a bank" check exists
// upstream, and building one here would duplicate logic analysis-ts already deliberately
// doesn't do (see bankNplRatioDefinition's own note: "非銀行公司一律優雅降級成
// missing_input，不做前置的「這家公司是不是銀行」判斷").
const props = defineProps<{
  symbol: string
}>()

const METRIC_CODES = ['bankNplRatio', 'bankNplCoverageRatio', 'bankCarRatio', 'bankCet1Ratio', 'bankTier1Ratio']

const symbolRef = computed(() => props.symbol)
const activeTab = ref<'近5年' | '近10年'>('近5年')
const limit = computed(() => (activeTab.value === '近5年' ? 20 : 40))

const history = useMetricsHistory(symbolRef, ref(METRIC_CODES), ref('Q'), limit)

const tenYearDisabled = computed(() => history.total.value !== null && history.total.value < 40)

interface Point {
  label: string
  bankNplRatio: number | null
  bankNplCoverageRatio: number | null
  bankCarRatio: number | null
  bankCet1Ratio: number | null
  bankTier1Ratio: number | null
}

function periodLabel(entry: { fiscalYear: number; fiscalQuarter: number }): string {
  return `${entry.fiscalYear} Q${entry.fiscalQuarter}`
}

const points = computed<Point[]>(() =>
  (history.data.value ?? []).map((entry: MetricsHistoryEntry) => ({
    label: periodLabel(entry),
    bankNplRatio: entry.values.bankNplRatio?.value ?? null,
    bankNplCoverageRatio: entry.values.bankNplCoverageRatio?.value ?? null,
    bankCarRatio: entry.values.bankCarRatio?.value ?? null,
    bankCet1Ratio: entry.values.bankCet1Ratio?.value ?? null,
    bankTier1Ratio: entry.values.bankTier1Ratio?.value ?? null
  }))
)

const hasAnyData = computed(() =>
  points.value.some(
    point =>
      point.bankNplRatio !== null ||
      point.bankNplCoverageRatio !== null ||
      point.bankCarRatio !== null ||
      point.bankCet1Ratio !== null ||
      point.bankTier1Ratio !== null
  )
)

const latestPoint = computed(() => {
  const list = points.value
  for (let i = list.length - 1; i >= 0; i--) {
    const point = list[i]!
    if (
      point.bankNplRatio !== null ||
      point.bankNplCoverageRatio !== null ||
      point.bankCarRatio !== null ||
      point.bankCet1Ratio !== null ||
      point.bankTier1Ratio !== null
    )
      return point
  }
  return null
})

// Same family visual language as other resilience cards — fixed colors, LIGHT variants
// darkened for WCAG 1.4.11's 3:1 non-text contrast.
const BANK_CAPITAL_COLORS = {
  DARK: { bankNplRatio: '#ee9baa', bankNplCoverageRatio: '#5ac8c8', bankCarRatio: '#d4a72c', bankCet1Ratio: '#5b8ff9', bankTier1Ratio: '#c792ea' },
  LIGHT: { bankNplRatio: '#c23a5e', bankNplCoverageRatio: '#238888', bankCarRatio: '#aa841f', bankCet1Ratio: '#4984fd', bankTier1Ratio: '#b368e5' }
}

const { resolvedMode } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))
const lineColors = computed(() => BANK_CAPITAL_COLORS[resolvedMode.value])

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
        `<div style="${rowStyle}"><span>${label}</span><strong>${value !== null ? `${value.toFixed(2)}%` : '未揭露'}</strong></div>`
      return `<div style="font-size:16px;min-width:190px;">
        <div style="font-weight:600;margin-bottom:4px;">${point.label}</div>
        ${row('逾期放款比率', point.bankNplRatio)}
        ${row('備抵呆帳覆蓋率', point.bankNplCoverageRatio)}
        ${row('資本適足率', point.bankCarRatio)}
        ${row('CET1 比率', point.bankCet1Ratio)}
        ${row('Tier 1 比率', point.bankTier1Ratio)}
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
      name: '覆蓋率 %',
      nameTextStyle: { color: chartInk.value.muted, fontSize: 16 },
      scale: true,
      splitLine: { show: false },
      axisLabel: { color: chartInk.value.muted, fontSize: 16 }
    }
  ],
  series: [
    {
      name: '逾期放款比率',
      type: 'line',
      yAxisIndex: 0,
      showSymbol: true,
      symbolSize: 6,
      lineStyle: { width: 2, color: lineColors.value.bankNplRatio },
      itemStyle: { color: lineColors.value.bankNplRatio },
      data: points.value.map(point => point.bankNplRatio)
    },
    {
      name: '備抵呆帳覆蓋率',
      type: 'line',
      yAxisIndex: 1,
      showSymbol: true,
      symbolSize: 6,
      lineStyle: { width: 2, color: lineColors.value.bankNplCoverageRatio },
      itemStyle: { color: lineColors.value.bankNplCoverageRatio },
      data: points.value.map(point => point.bankNplCoverageRatio)
    },
    {
      name: '資本適足率',
      type: 'line',
      yAxisIndex: 0,
      showSymbol: true,
      symbolSize: 6,
      lineStyle: { width: 2.5, color: lineColors.value.bankCarRatio },
      itemStyle: { color: lineColors.value.bankCarRatio },
      data: points.value.map(point => point.bankCarRatio),
      z: 10
    },
    {
      name: 'CET1 比率',
      type: 'line',
      yAxisIndex: 0,
      showSymbol: true,
      symbolSize: 6,
      lineStyle: { width: 2, color: lineColors.value.bankCet1Ratio },
      itemStyle: { color: lineColors.value.bankCet1Ratio },
      data: points.value.map(point => point.bankCet1Ratio)
    },
    {
      name: 'Tier 1 比率',
      type: 'line',
      yAxisIndex: 0,
      showSymbol: true,
      symbolSize: 6,
      lineStyle: { width: 2, color: lineColors.value.bankTier1Ratio },
      itemStyle: { color: lineColors.value.bankTier1Ratio },
      data: points.value.map(point => point.bankTier1Ratio)
    }
  ]
}))
</script>

<template>
  <el-card class="bank-capital-chart" shadow="never" :body-style="{ padding: '4px 4px 8px' }">
    <template #header>
      <div class="bank-capital-chart__header">
        <span class="bank-capital-chart__title">
          銀行資本適足性
          <el-tooltip :content="INFO_TEXT" placement="top" :popper-style="{ maxWidth: '280px' }">
            <el-icon class="bank-capital-chart__info"><InfoFilled /></el-icon>
          </el-tooltip>
        </span>
        <SharedLookbackWindowSelect v-model="activeTab" :ten-year-insufficient="tenYearDisabled" />
      </div>
    </template>

    <el-empty v-if="!history.pending.value && !hasAnyData" description="這檔股票非銀行／金控業，或尚無資本適足性揭露資料" :image-size="64" />
    <template v-else>
      <VChart v-loading="history.pending.value" class="bank-capital-chart__chart" :option="option" autoresize />
      <SharedDataFreshnessNote source-label="金融機構監理資訊揭露" :as-of="latestPoint?.label ?? null" />
    </template>
  </el-card>
</template>

<style scoped>
.bank-capital-chart {
  border-radius: 12px;
}

.bank-capital-chart__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.bank-capital-chart__title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.bank-capital-chart__info {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  cursor: help;
}

.bank-capital-chart__chart {
  height: 260px;
  width: 100%;
}
</style>
