<script setup lang="ts">
import type { LookbackWindow } from '~/utils/lookback-window'
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { InfoFilled } from '@element-plus/icons-vue'
import type { MetricsHistoryEntry } from '~/composables/stock/useMetricsHistory'

use([SVGRenderer, LineChart, GridComponent, TooltipComponent])

// INFO_TEXT reverted to a plain frontend-authored string 2026-09-14 ("我之前說 INFO_TEXT 改用
// 後端數值，那是個錯誤的決定，請用前端自己生成的中文描述") — undoes the 2026-09-14 change that
// wired this to analysis-ts's own GET /metrics field-level `description`/`formulaLatex` via
// locateFieldInSchema. Same ≤30-char convention as every other chart's own INFO_TEXT in this app.
const INFO_TEXT = 'Fama-French五因子RMW代理變數'

// 獲利能力 tab card, per direct pointer to analysis-ts's own famaFrenchOperatingProfitability
// (2026-09-10, same session as SUE/Chowder). Real, well-documented Fama & French (2015)
// five-factor model concept — RMW (Robust-Minus-Weak) is the model's own "profitability" factor,
// and this metric is its single-company operating-profitability RATIO component (Revenue - COGS
// - SG&A - Interest, over Book Equity), NOT the full factor itself — analysis-ts's own
// formulaNote is explicit that the complete RMW factor needs a market-wide cross-sectional
// sort + time-series regression this service has no infrastructure for yet (see their
// TECH_DEBT.md), so this is a variant_of the full model, same honesty level as sue/chowderNumber.
//
// Deliberately built as a CHART ONLY, no guru badge — unlike SUE/Chowder Number, Fama-French's
// profitability factor has no absolute pass/fail threshold in the literature; RMW is inherently
// a RELATIVE cross-sectional ranking (top vs. bottom profitability quintile across the whole
// market each period), not a bar any single company's ratio clears or fails on its own terms.
// Inventing an absolute cutoff here would repeat the exact mistake already corrected earlier
// this session (see guru-badges.ts's own history of removing Nissim-Penman RNOA/SGR badges for
// having thresholds that weren't real) — a chart showing the trend is the honest presentation.
//
// TTM timeframe by default (smooths single-quarter noise, same reasoning as
// StockCapexIntensityChart.vue's own comment); Q is also supported by the metric itself but not
// exposed here since every other TTM-first single-metric card in this app makes the same call.
const props = defineProps<{
  symbol: string
}>()

const symbolRef = computed(() => props.symbol)
const activeTab = ref<LookbackWindow>('近5年')
const limit = computed(() => LOOKBACK_WINDOW_YEARS[activeTab.value] * 4)

// Timeframe flipped TTM→Q 2026-09-14 per direct request across all cards ("針對所有卡片，都先幫我
// 改成單季呈現或是預設單季") — 稽核鏈 reasoning, see StockAccrualsQualityChart.vue's own comment
// for the full explanation. famaFrenchOperatingProfitability has a real 'Q' field (GET /metrics).
const history = useMetricsHistory(symbolRef, ref(['famaFrenchOperatingProfitability']), ref('Q'), limit)

const disabledYears = computed(() =>
  LOOKBACK_YEARS.filter(years => history.total.value !== null && history.total.value! < years * 4)
)

interface Point {
  label: string
  famaFrenchOperatingProfitability: number | null
}

function periodLabel(entry: { fiscalYear: number; fiscalQuarter: number }): string {
  return `${entry.fiscalYear} Q${entry.fiscalQuarter}`
}

const points = computed<Point[]>(() =>
  (history.data.value ?? []).map((entry: MetricsHistoryEntry) => ({
    label: periodLabel(entry),
    famaFrenchOperatingProfitability: entry.values.famaFrenchOperatingProfitability?.value ?? null
  }))
)

const hasAnyData = computed(() => points.value.some(point => point.famaFrenchOperatingProfitability !== null))

const latestPoint = computed(() => {
  const list = points.value
  for (let i = list.length - 1; i >= 0; i--) {
    const point = list[i]!
    if (point.famaFrenchOperatingProfitability !== null) return point
  }
  return null
})

const { resolvedMode } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))
const lineColor = computed(() => getChartAccentGold(resolvedMode.value))

interface AxisTooltipParam {
  dataIndex?: number
}

const option = computed(() => ({
  textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  grid: { left: 8, right: 8, top: 36, bottom: 28, containLabel: true },
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
      return `<div style="font-size:16px;min-width:170px;">
        <div style="font-weight:600;margin-bottom:4px;">${point.label}</div>
        <div>營業獲利力：<strong>${point.famaFrenchOperatingProfitability !== null ? `${point.famaFrenchOperatingProfitability.toFixed(2)}%` : '資料不足'}</strong></div>
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
      name: '營業獲利力',
      type: 'line',
      showSymbol: true,
      symbolSize: 6,
      lineStyle: { width: 2, color: lineColor.value },
      itemStyle: { color: lineColor.value },
      data: points.value.map(point => point.famaFrenchOperatingProfitability)
    }
  ]
}))
</script>

<template>
  <el-card class="fama-french-profitability-chart" shadow="never">
    <template #header>
      <div class="fama-french-profitability-chart__header">
        <span class="fama-french-profitability-chart__title">
          Fama-French 營業獲利力
          <el-tooltip :content="INFO_TEXT" placement="top" :popper-style="{ maxWidth: '280px' }">
            <el-icon class="fama-french-profitability-chart__info"><InfoFilled /></el-icon>
          </el-tooltip>
        </span>
        <SharedLookbackWindowSelect v-model="activeTab" :disabled-years="disabledYears" />
      </div>
    </template>

    <el-empty v-if="!history.pending.value && !hasAnyData" description="這檔股票尚無歷史資料，可能尚未排入資料回填" :image-size="64" />
    <template v-else>
      <VChart v-loading="history.pending.value" class="fama-french-profitability-chart__chart" :option="option" :init-options="{ renderer: 'svg' }" autoresize />
      <SharedDataFreshnessNote source-label="公開發行公司財務報表" :as-of="latestPoint?.label ?? null" />
    </template>
  </el-card>
</template>

<style scoped>
.fama-french-profitability-chart {
  border-radius: 12px;
}

.fama-french-profitability-chart__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.fama-french-profitability-chart__title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.fama-french-profitability-chart__info {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  cursor: help;
}

.fama-french-profitability-chart__chart {
  height: 240px;
  width: 100%;
}
</style>
