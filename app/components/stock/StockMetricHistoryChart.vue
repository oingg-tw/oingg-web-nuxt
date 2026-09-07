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
// The "河流圖" (river chart) bands are computed HERE from the same real series shown, not
// separate band data from the backend — analysis-ts's endpoint returns one value per period,
// not percentile-band boundaries. This computes percentile levels (min/25/50/75/max) of the
// metric's OWN historical distribution across the current lookback window and renders them as
// flat reference bands the actual line runs through — a legitimate, commonly-used "where does
// today sit relative to its own history" valuation view, not a fabricated number (per direct
// request after the plain single-line version shipped: "紅綠背景不見了" wanted the band
// visual back). Different from the old StockRiverChart.vue's bands (deleted — see below),
// which assumed the backend supplied a separate, independently time-varying value per band;
// these are flat per-window because a percentile of a fixed set is a single number, not a
// series.
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

// Both the ratio line's own color and the percentile bands beneath it follow the user's own
// theme/market-convention choices (getAccentColor/getPriceColors), not a fixed brand color —
// per direct request ("本益比河流圖的線 那條顏色要跟著網站主題色變動") for the line, and
// matching the old StockRiverChart.vue's own reasoning for the bands (highest value reads as
// "up", lowest as "down", flipping together with every other up/down color when the user picks
// WESTERN or ACCESSIBLE).
const { resolvedMode, color: accentColor, market } = useAppTheme()
const lineColor = computed(() => getAccentColor(resolvedMode.value, accentColor.value))
const priceColors = computed(() => getPriceColors(resolvedMode.value, market.value))
const bandPalette = computed(() => riverColors(priceColors.value.up, priceColors.value.down))

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0]!
  const idx = (sorted.length - 1) * p
  const lower = Math.floor(idx)
  const upper = Math.ceil(idx)
  if (lower === upper) return sorted[lower]!
  const weight = idx - lower
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight
}

// 5 percentile levels (min/25/50/75/max) of the metric's own real values across the currently
// shown window — only for line charts (peRatio/pbRatio); EPS's bar chart uses diverging
// positive/negative bar colors instead (see below), not bands. Needs at least 2 real values to
// mean anything as a *range*; fewer than that renders no bands, just the plain line.
const bandLevels = computed<number[] | null>(() => {
  if (props.chartType !== 'line') return null
  const values = (entries.value ?? []).map(entry => entry.value).filter((v): v is number => v !== null)
  if (values.length < 2) return null
  const sorted = [...values].sort((a, b) => a - b)
  return [0, 0.25, 0.5, 0.75, 1].map(p => percentile(sorted, p))
})

// Flat per-window band series data — a percentile of a fixed set is one number, so each band
// is the same constant repeated across every x-axis point, not a genuinely time-varying line.
function bandSeries() {
  const levels = bandLevels.value
  if (!levels) return []
  const length = entries.value?.length ?? 0
  return levels.map((level, i) => {
    const previous = levels[i - 1]
    const flat = Array.from({ length }, () => level)
    const data = previous !== undefined ? flat.map(v => v - previous) : flat
    return {
      name: `p${[0, 25, 50, 75, 100][i]}`,
      type: 'line' as const,
      data,
      stack: 'river',
      showSymbol: false,
      silent: true,
      lineStyle: { width: 0 },
      itemStyle: { color: bandPalette.value.lines[i] },
      ...(previous !== undefined ? { areaStyle: { color: bandPalette.value.fills[i - 1], opacity: 0.5 } } : {}),
      z: 1
    }
  })
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
    ...bandSeries(),
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

    <p v-if="chartType === 'line' && hasAnyData && !bandLevels" class="metric-history-chart__note">
      資料點不足，無法計算歷史區間分佈
    </p>
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

.metric-history-chart__note {
  margin: 8px 0 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
  text-align: center;
}
</style>
