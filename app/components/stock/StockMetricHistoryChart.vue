<script setup lang="ts">
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import type { MetricBasis, MetricCode } from '~/composables/stock/useMetricHistory'

use([CanvasRenderer, BarChart, LineChart, GridComponent, TooltipComponent])

// Shared by the real single-value-per-period charts bff-ts backs (confirmed live 2026-09-07):
// 本益比河流圖 (peRatio/TTM, line), 本淨比河流圖 (pbRatio/Q, line), 四季 EPS (eps/TTM, bar) via
// GET /stocks/:symbol/metric-history, plus ROE/ROA (roe/roa, own dedicated
// /stocks/:symbol/roe-history|roa-history endpoints — see useMetricHistory.ts's own
// endpointPathFor) — replacing StockChartShell placeholders for all of these. dupont-history's
// multi-factor shape doesn't fit this single-value model at all — see StockDupontChart.vue,
// a separate component.
//
// The "河流圖" (river chart) bands are computed HERE from the same real series shown, not
// separate band data from the backend — analysis-ts's endpoint returns one value per period,
// not percentile-band boundaries. Each point's band is the percentile distribution (min/25/
// 50/75/max) of every real value FROM THE START OF THE FETCHED WINDOW UP TO THAT POINT — an
// expanding lookback, not the whole-window flat band this component shipped with initially
// (rejected live: "河流圖不該這樣從頭到尾都直線吧，這樣還叫河流圖嗎" — a single static band
// isn't a river). This makes the bands genuinely time-varying (shift/narrow/widen as more
// history accumulates), the actual shape a real river chart has, while still only ever being
// computed from real fetched values, never fabricated. Points before MIN_BAND_SAMPLES real
// values have accumulated show no band at all (not a degenerate near-zero-width one from 1-2
// samples) — a real gap, same as the line's own null handling.
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

const { data: entries, pending, total } = useMetricHistory(symbolRef, metricCodeRef, basisRef, limit)

// analysis-ts's `total` (added 2026-09-07) is the FULL available period count regardless of
// `limit` — once the 近5年 fetch already tells us total <= 20, clicking 近10年 would just
// re-fetch the identical data, so it's disabled up front instead of letting the user click it
// and discover nothing changed. total is only known once the currently active tab's own
// request resolves, so this stays false (not disabled) until then — same "don't assert
// something not yet confirmed" caution as everywhere else null/undefined is handled here.
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

// Below this many real values accumulated so far, a percentile band is more misleading than
// informative (e.g. 2 samples collapses min/25/50/75/max to near-identical numbers) — no band
// renders for that point at all rather than a degenerate sliver.
const MIN_BAND_SAMPLES = 4

// One 5-level percentile array per x-axis point (or null before MIN_BAND_SAMPLES real values
// have accumulated), each computed from every real value seen from the start of the fetched
// window through that point — only for line charts (peRatio/pbRatio); EPS's bar chart uses
// diverging positive/negative bar colors instead (see below), not bands.
const rollingBandLevels = computed<(number[] | null)[]>(() => {
  if (props.chartType !== 'line') return []
  const seen: number[] = []
  return (entries.value ?? []).map(entry => {
    if (entry.value !== null) seen.push(entry.value)
    if (seen.length < MIN_BAND_SAMPLES) return null
    const sorted = [...seen].sort((a, b) => a - b)
    return [0, 0.25, 0.5, 0.75, 1].map(p => percentile(sorted, p))
  })
})

const hasAnyBand = computed(() => rollingBandLevels.value.some(levels => levels !== null))

// Each band series' raw level per point, then converted to the stacked-delta shape ECharts
// needs to render adjacent bands as a contiguous filled region (a band's own plotted value is
// its gap above the PREVIOUS band, not its absolute level) — null at any point in either the
// band itself or the one below it propagates as null (a real gap), never coerced to 0, so an
// early point with no band yet doesn't render as a false zero-width sliver.
function bandSeries() {
  const levelsPerPoint = rollingBandLevels.value
  if (!levelsPerPoint.length) return []
  return [0, 1, 2, 3, 4].map(bandIndex => {
    const raw = levelsPerPoint.map(levels => levels?.[bandIndex] ?? null)
    const data =
      bandIndex === 0
        ? raw
        : raw.map((value, i) => {
            const previous = levelsPerPoint[i]?.[bandIndex - 1] ?? null
            return value === null || previous === null ? null : value - previous
          })
    return {
      name: `p${[0, 25, 50, 75, 100][bandIndex]}`,
      type: 'line' as const,
      data,
      stack: 'river',
      showSymbol: false,
      silent: true,
      lineStyle: { width: 0 },
      itemStyle: { color: bandPalette.value.lines[bandIndex] },
      ...(bandIndex > 0 ? { areaStyle: { color: bandPalette.value.fills[bandIndex - 1], opacity: 0.5 } } : {}),
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
            :disabled="tab === '近10年' && tenYearDisabled"
            :title="tab === '近10年' && tenYearDisabled ? '這檔股票的歷史資料不足10年，目前顯示的已是完整範圍' : undefined"
            @click="activeTab = tab"
          >{{ tab }}</button>
        </div>
      </div>
    </template>

    <el-empty v-if="!pending && !hasAnyData" description="這檔股票尚無歷史資料，可能尚未排入資料回填" :image-size="64" />
    <VChart v-else v-loading="pending" class="metric-history-chart__chart" :option="option" autoresize />

    <p v-if="chartType === 'line' && hasAnyData && !hasAnyBand" class="metric-history-chart__note">
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

.metric-history-chart__tab:disabled {
  cursor: not-allowed;
  opacity: 0.5;
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
