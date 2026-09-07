<script setup lang="ts">
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { InfoFilled } from '@element-plus/icons-vue'
import type { MetricBasis, MetricCode } from '~/composables/stock/useMetricHistory'

use([CanvasRenderer, BarChart, LineChart, GridComponent, TooltipComponent])

// Plain single-value-per-period history chart over bff-ts's metric-history family (confirmed
// live 2026-09-07): 四季 EPS (eps/TTM, bar) via GET /stocks/:symbol/metric-history, plus ROE/ROA
// (roe/roa, own dedicated /stocks/:symbol/roe-history|roa-history endpoints — see
// useMetricHistory.ts's own endpointPathFor) as lines. dupont-history's multi-factor shape
// doesn't fit this single-value model — see StockDupontChart.vue, a separate component.
//
// 本益比/本淨比河流圖 used to live here too, as this same ratio line with a cumulative-
// percentile envelope (min/25/50/75/max of every value seen so far) drawn behind it. That
// envelope was arithmetically right and conceptually wrong — a running min only goes down and a
// running max only goes up, so its outer edges flatten into horizontal lines for most of the
// window ("現在紅綠色就一條橫線"), and no amount of warm-up buffer or edge fade-in (both tried,
// both removed with it) changes that. A real river chart lives in price-space, not ratio-space:
// see StockValuationRiverChart.vue, which now owns both river cards. This component is bands-
// free as a result; ROE/ROA are plain trend lines, which is all they ever needed to be.
//
// Old StockRiverChart.vue/StockEpsChart.vue deleted — both expected a mocked shape
// (ValuationBand/QuarterlyEpsPoint from useStockDetail.ts) no endpoint ever backed.
const props = defineProps<{
  symbol: string
  metricCode: MetricCode
  basis: MetricBasis
  title: string
  chartType: 'line' | 'bar'
  unit: string
  // Per direct request ("卡片標題都加上info icon") — a short plain-language explanation of
  // what this specific metric means, shown on hover next to the title. Optional (not required)
  // since this component is shared across several metrics with different explanations, each
  // passed in by the call site in stock/[code].vue rather than hardcoded here.
  infoText?: string
}>()

const symbolRef = computed(() => props.symbol)
const metricCodeRef = computed(() => props.metricCode)
const basisRef = computed(() => props.basis)

// 近5年/近10年 lookback window, matching the multi-year convention this app already uses for
// financial-history charts (StockShareCapitalChart.vue, StockPeriodSelector's own MOPS-year
// range) and docs/investment-knowledge/基本面財報觀察年限分析.md's own argument for it — one
// period is one quarter, so 20/40 periods is exactly 5/10 years (40 is also
// metric-history's own documented limit ceiling).
const activeTab = ref<'近5年' | '近10年'>('近5年')
const limit = computed(() => (activeTab.value === '近5年' ? 20 : 40))

const { data: entries, pending, total } = useMetricHistory(symbolRef, metricCodeRef, basisRef, limit)

// analysis-ts's `total` (added 2026-09-07) is the FULL available period count regardless of
// `limit` — once the 近5年 fetch already tells us total <= 20, clicking 近10年 would just
// re-fetch the identical data, so it's disabled up front instead of letting the user click it
// and discover nothing changed. total is only known once the currently active tab's own
// request resolves, so this stays false (not disabled) until then — same "don't assert
// something not yet confirmed" caution as everywhere else null/undefined is handled here.
// (As of 2026-09-07 the proxy has been observed dropping total entirely — this then just
// never disables, which is the safe direction.)
const tenYearDisabled = computed(() => total.value !== null && total.value <= 20)

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

// Line color follows the user's own accent choice (per direct request "那條顏色要跟著網站主題色
// 變動", originally for the river line that used to live here); EPS bars follow their up/down
// market convention so a loss quarter reads as "down" and flips with WESTERN/ACCESSIBLE like
// every other up/down color in the app.
const { resolvedMode, color: accentColor, market } = useAppTheme()
const lineColor = computed(() => getAccentColor(resolvedMode.value, accentColor.value))
const priceColors = computed(() => getPriceColors(resolvedMode.value, market.value))

interface AxisTooltipParam {
  dataIndex?: number
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
          data: (entries.value ?? []).map(entry => {
            if (entry.value === null) return null
            const isLoss = entry.value < 0
            return {
              value: entry.value,
              itemStyle: { color: isLoss ? priceColors.value.down : priceColors.value.up, borderRadius: [4, 4, 0, 0] }
            }
          })
        }
      : {
          type: 'line',
          showSymbol: false,
          smooth: true,
          smoothMonotone: 'x',
          lineStyle: { width: 2.5, color: lineColor.value },
          itemStyle: { color: lineColor.value },
          data: (entries.value ?? []).map(entry => entry.value),
          z: 10
        }
  ]
}))
</script>

<template>
  <el-card class="metric-history-chart" shadow="never" :body-style="{ padding: '4px 4px 8px' }">
    <template #header>
      <div class="metric-history-chart__header">
        <span class="metric-history-chart__title">
          {{ title }}
          <el-tooltip v-if="infoText" :content="infoText" placement="top" :popper-style="{ maxWidth: '280px' }">
            <el-icon class="metric-history-chart__info"><InfoFilled /></el-icon>
          </el-tooltip>
        </span>
        <SharedLookbackWindowSelect v-model="activeTab" :ten-year-insufficient="tenYearDisabled" />
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
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.metric-history-chart__info {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  cursor: help;
}

.metric-history-chart__chart {
  height: 240px;
  width: 100%;
}
</style>
