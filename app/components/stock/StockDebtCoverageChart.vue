<script setup lang="ts">
import type { LookbackWindow } from '~/utils/lookback-window'
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { InfoFilled } from '@element-plus/icons-vue'

// 稽核鏈 timeframe flip 2026-09-14 per direct request across all cards ("針對所有卡片，都先幫我改成
// 單季呈現或是預設單季") — interestCoverage 有真正的 'Q' 欄位，但 netDebtToEbitda 當時只有
// 'Q_ANN'（沒有純 'Q'），兩個指標沒辦法共用同一個 timeframe 參數打同一支請求，所以拆成兩支各自的
// useMetricsHistory 呼叫，同 StockHistoricalStatisticsTable.vue 的多基準做法——這個「兩支獨立
// 請求」的架構本身沒有跟著下面這次改動一起撤掉，因為 interestCoverage 仍然是 'Q'。
// netDebtToEbitda 那支 2026-09-14 稍晚又改回 'TTM'——analysis-ts 把 Q_ANN 這個 timeframe 整個從
// 全部指標移除了（commit 054ae0b，省運算成本），不是只影響這支，netDebtToEbitda 現在只剩
// 'TTM' 一種選擇，稽核鏈單一期別可追溯的目標暫時做不到，是已知缺口。

use([SVGRenderer, LineChart, GridComponent, LegendComponent, TooltipComponent])

// 30-char strict cap (standing rule, see feedback_info_text_30_char_limit memory).
const INFO_TEXT = '現金流夠不夠付息、還清淨負債要幾年'

// Card 3 of the 財務韌性/resilience family (design confirmed directly 2026-09-10) —
// interestCoverage/netDebtToEbitda, both TTM and both nominally "倍", but NOT put on a shared
// axis despite the matching unit — confirmed live (2330: interestCoverage 227倍 vs
// netDebtToEbitda -0.67倍) the two routinely differ by 2+ orders of magnitude for a
// low-debt/high-margin company, which would flatten netDebtToEbitda to an unreadable near-zero
// line on a shared axis. Dual y-axis instead, same defensive choice as
// StockDividendCoverageChart.vue/StockLeverageChart.vue even where their units already differed
// outright. Complements sibling StockLeverageChart.vue's balance-sheet-snapshot leverage view
// with the cash-flow angle: can EBIT actually cover interest payments, and how many years of
// EBITDA would it take to pay off net debt.
const props = defineProps<{
  symbol: string
}>()

const symbolRef = computed(() => props.symbol)
const activeTab = ref<LookbackWindow>('近5年')
const limit = computed(() => LOOKBACK_WINDOW_YEARS[activeTab.value] * 4)

const interestCoverageHistory = useMetricsHistory(symbolRef, ref(['interestCoverage']), ref('Q'), limit)
const netDebtToEbitdaHistory = useMetricsHistory(symbolRef, ref(['netDebtToEbitda']), ref('TTM'), limit)

const historyPending = computed(() => interestCoverageHistory.pending.value || netDebtToEbitdaHistory.pending.value)
const historyTotal = computed(() => {
  const totals = [interestCoverageHistory.total.value, netDebtToEbitdaHistory.total.value].filter((value): value is number => value !== null)
  return totals.length ? Math.max(...totals) : null
})
const disabledYears = computed(() =>
  LOOKBACK_YEARS.filter(years => historyTotal.value !== null && historyTotal.value! < years * 4)
)

interface Point {
  label: string
  interestCoverage: number | null
  netDebtToEbitda: number | null
}

function periodLabel(entry: { fiscalYear: number; fiscalQuarter: number }): string {
  return `${entry.fiscalYear} Q${entry.fiscalQuarter}`
}

// Merges the two bases' own entries by fiscalYear/fiscalQuarter — same reasoning as
// StockHistoricalStatisticsTable.vue's own multi-timeframe merge.
const points = computed<Point[]>(() => {
  const byPeriod = new Map<string, Point & { fiscalYear: number; fiscalQuarter: number }>()
  for (const entry of interestCoverageHistory.data.value ?? []) {
    const key = periodLabel(entry)
    byPeriod.set(key, { label: key, interestCoverage: entry.values.interestCoverage?.value ?? null, netDebtToEbitda: null, fiscalYear: entry.fiscalYear, fiscalQuarter: entry.fiscalQuarter })
  }
  for (const entry of netDebtToEbitdaHistory.data.value ?? []) {
    const key = periodLabel(entry)
    const existing = byPeriod.get(key)
    if (existing) existing.netDebtToEbitda = entry.values.netDebtToEbitda?.value ?? null
    else byPeriod.set(key, { label: key, interestCoverage: null, netDebtToEbitda: entry.values.netDebtToEbitda?.value ?? null, fiscalYear: entry.fiscalYear, fiscalQuarter: entry.fiscalQuarter })
  }
  return [...byPeriod.values()].sort((a, b) => a.fiscalYear - b.fiscalYear || a.fiscalQuarter - b.fiscalQuarter)
})

const hasAnyData = computed(() => points.value.some(point => point.interestCoverage !== null || point.netDebtToEbitda !== null))

const latestPoint = computed(() => {
  const list = points.value
  for (let i = list.length - 1; i >= 0; i--) {
    const point = list[i]!
    if (point.interestCoverage !== null || point.netDebtToEbitda !== null) return point
  }
  return null
})

// Same family visual language as StockLeverageChart.vue — fixed colors, LIGHT variants
// darkened for WCAG 1.4.11's 3:1 non-text contrast.
const DEBT_COVERAGE_COLORS = {
  DARK: { interestCoverage: '#5b8ff9', netDebtToEbitda: '#ee9baa' },
  LIGHT: { interestCoverage: '#4984fd', netDebtToEbitda: '#c23a5e' }
}

const { resolvedMode } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))
const lineColors = computed(() => DEBT_COVERAGE_COLORS[resolvedMode.value])

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
      const row = (label: string, value: number | null) =>
        `<div style="${rowStyle}"><span>${label}</span><strong>${value !== null ? `${value.toFixed(2)} 倍` : '資料不足'}</strong></div>`
      return `<div style="font-size:16px;min-width:190px;">
        <div style="font-weight:600;margin-bottom:4px;">${point.label}</div>
        ${row('利息保障倍數', point.interestCoverage)}
        ${row('淨負債對EBITDA比', point.netDebtToEbitda)}
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
      name: '倍',
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
      name: '利息保障倍數',
      type: 'line',
      yAxisIndex: 0,
      showSymbol: true,
      symbolSize: 6,
      lineStyle: { width: 2.5, color: lineColors.value.interestCoverage },
      itemStyle: { color: lineColors.value.interestCoverage },
      data: points.value.map(point => point.interestCoverage),
      z: 10
    },
    {
      name: '淨負債對EBITDA比',
      type: 'line',
      yAxisIndex: 1,
      showSymbol: true,
      symbolSize: 6,
      lineStyle: { width: 2, color: lineColors.value.netDebtToEbitda },
      itemStyle: { color: lineColors.value.netDebtToEbitda },
      data: points.value.map(point => point.netDebtToEbitda)
    }
  ]
}))
</script>

<template>
  <el-card class="debt-coverage-chart" shadow="never" :body-style="{ padding: '4px 4px 8px' }">
    <template #header>
      <div class="debt-coverage-chart__header">
        <span class="debt-coverage-chart__title">
          償債能力（現金流角度）
          <el-tooltip :content="INFO_TEXT" placement="top" :popper-style="{ maxWidth: '280px' }">
            <el-icon class="debt-coverage-chart__info"><InfoFilled /></el-icon>
          </el-tooltip>
        </span>
        <SharedLookbackWindowSelect v-model="activeTab" :disabled-years="disabledYears" />
      </div>
    </template>

    <el-empty v-if="!historyPending && !hasAnyData" description="這檔股票尚無歷史資料，可能尚未排入資料回填" :image-size="64" />
    <template v-else>
      <VChart v-loading="historyPending" class="debt-coverage-chart__chart" :option="option" :init-options="{ renderer: 'svg' }" autoresize />
      <SharedDataFreshnessNote source-label="公開發行公司財務報表" :as-of="latestPoint?.label ?? null" />
    </template>
  </el-card>
</template>

<style scoped>
.debt-coverage-chart {
  border-radius: 12px;
}

.debt-coverage-chart__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.debt-coverage-chart__title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.debt-coverage-chart__info {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  cursor: help;
}

.debt-coverage-chart__chart {
  height: 260px;
  width: 100%;
}
</style>
