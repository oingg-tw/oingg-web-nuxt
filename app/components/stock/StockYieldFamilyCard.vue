<script setup lang="ts">
import type { LookbackWindow } from '~/utils/lookback-window'
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { InfoFilled } from '@element-plus/icons-vue'
import type { MetricsHistoryEntry } from '~/composables/stock/useMetricsHistory'

use([SVGRenderer, LineChart, GridComponent, LegendComponent, TooltipComponent])

// 收益率家族卡片 — REBUILT 2026-09-14 twice the same day: first into a small-multiples chart (per
// "改成真的歷史線圖"), then again per direct follow-up once that read as low-signal ("收益率家族
// 這樣呈現好像看不出甚麼特別意義") — confirmed via AskUserQuestion the fix is "不要 Greenblatt
// 盈餘收益率 其他兩個疊一起": drop greenblattEarningsYield entirely, overlay 盈餘收益率
// (earningsYield) and 自由現金流殖利率 (fcfYield) on ONE chart instead of 3 separate mini-charts.
// Both are % and the same underlying concept (this stock's own earnings/FCF relative to its
// price), so overlaying them directly answers "which one is higher, and do they move together" —
// exactly the comparison 3 flat separate mini-charts couldn't show at a glance. Still within this
// app's own ≤2-line overlay cap (see StockMarginsChart.vue's own comment on that rule), unlike
// the original 3-metric version would have been.
//
// Card title (header/picker label) renamed 收益率家族 → 獲利收益率 2026-09-15 per direct request
// ("市場評價這邊卡片都幫我改名平易近人") — "家族" read as unnecessary jargon for a general
// audience; the two metric labels inside (盈餘收益率/自由現金流殖利率) are unchanged.
const props = defineProps<{
  symbol: string
}>()

// 改寫 2026-09-15 per直接指示（"該說什麼：描述指標衡量的現象，不評價標的"）——原文「兩種賺錢能力
// 的殖利率走勢」沒有明確評價字眼，但也沒說清楚兩個指標實際在算什麼；改成跟本益比／負債比等指標同一
// 種寫法（"X反映每100元Y對應到的Z金額"），只描述算式在衡量什麼現象，不下"越高越好/越便宜"這類結論
// ——高低如何解讀留給使用者自己判斷，同一個數字在不同產業/景氣位置下意義可能完全相反。超過本檔慣用
// 30字上限（同 EV/EBITDA 卡片的既有例外）是刻意的，兩個指標各自的定義都要講清楚。
const INFO_TEXT = '盈餘收益率反映每100元股價，對應到公司稅後盈餘的金額；自由現金流殖利率反映每100元股價，對應到的自由現金流金額，兩者皆受產業特性與現金流認列時點影響'

const METRIC_CODES = ['earningsYield', 'fcfYield'] as const
type MetricKey = (typeof METRIC_CODES)[number]

const symbolRef = computed(() => props.symbol)
const activeTab = ref<LookbackWindow>('近5年')
const limit = computed(() => LOOKBACK_WINDOW_YEARS[activeTab.value] * 4)

const METRIC_LABELS: Record<MetricKey, string> = {
  earningsYield: '盈餘收益率',
  fcfYield: '自由現金流殖利率'
}

const history = useMetricsHistory(symbolRef, ref([...METRIC_CODES]), ref('TTM'), limit)
const disabledYears = computed(() =>
  LOOKBACK_YEARS.filter(years => history.total.value !== null && history.total.value! < years * 4)
)

interface Point {
  label: string
  values: Record<MetricKey, number | null>
}

function periodLabel(entry: { fiscalYear: number; fiscalQuarter: number }): string {
  return `${entry.fiscalYear} Q${entry.fiscalQuarter}`
}

const points = computed<Point[]>(() =>
  (history.data.value ?? []).map((entry: MetricsHistoryEntry) => ({
    label: periodLabel(entry),
    values: Object.fromEntries(METRIC_CODES.map(code => [code, entry.values[code]?.value ?? null])) as Record<MetricKey, number | null>
  }))
)

const hasAnyData = computed(() => points.value.some(point => METRIC_CODES.some(code => point.values[code] !== null)))

const latestPoint = computed(() => {
  const list = points.value
  for (let i = list.length - 1; i >= 0; i--) {
    if (METRIC_CODES.some(code => list[i]!.values[code] !== null)) return list[i]!
  }
  return null
})

const YIELD_COLORS = {
  DARK: { earningsYield: '#d4a72c', fcfYield: '#5b8ff9' },
  LIGHT: { earningsYield: '#aa841f', fcfYield: '#4984fd' }
} as const

const { resolvedMode, market } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))
const lineColors = computed(() => YIELD_COLORS[resolvedMode.value])
// Same site-wide up/down convention as every other valuation-percentile gauge (see
// StockValuationRiverChart.vue/StockEvMultiplesCard.vue) — a plain low→high magnitude scale, not
// an evaluative "high yield = good" read, kept consistent across cards rather than flipped per
// metric's own investment interpretation.
const priceColors = computed(() => getPriceColors(resolvedMode.value, market.value))

// ============================================================================
// 摘要層量尺 (summary-layer gauge, 卡片軌元件選型規範 2.4.1/2.4.2) — one gauge per metric, one
// shared toggle/expand for the combined chart (see SharedPercentileGaugeExpand.vue's own
// showToggle comment).
// ============================================================================

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`
}

const gaugeStatsByMetric = computed(() =>
  Object.fromEntries(
    METRIC_CODES.map(code => {
      const values = points.value.map(point => point.values[code]).filter((value): value is number => value !== null)
      const current = latestPoint.value?.values[code] ?? null
      return [code, computeGaugeStats(values, current)]
    })
  ) as Record<MetricKey, ReturnType<typeof computeGaugeStats>>
)

const chartExpanded = ref(false)

interface AxisTooltipParam {
  seriesName?: string
  value?: number | null
  dataIndex?: number
}

const option = computed(() => ({
  textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  grid: { left: 8, right: 8, top: 60, bottom: 24, containLabel: true },
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
      const rows = METRIC_CODES.map(code => {
        const v = point.values[code]
        return `<div style="${rowStyle}"><span>${METRIC_LABELS[code]}</span><strong>${v !== null ? `${v.toFixed(2)}%` : '資料不足'}</strong></div>`
      }).join('')
      return `<div style="font-size:16px;min-width:180px;">
        <div style="font-weight:600;margin-bottom:4px;">${point.label}</div>
        ${rows}
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
    min: (extent: { min: number }) => Math.min(0, extent.min),
    max: (extent: { max: number }) => Math.max(0, extent.max),
    splitLine: { lineStyle: { color: chartInk.value.gridline, type: 'solid' } },
    axisLabel: { color: chartInk.value.muted, fontSize: 16 }
  },
  series: METRIC_CODES.map(code => ({
    name: METRIC_LABELS[code],
    type: 'line',
    showSymbol: true,
    symbolSize: 6,
    smooth: true,
    smoothMonotone: 'x',
    lineStyle: { width: 2.5, color: lineColors.value[code] },
    itemStyle: { color: lineColors.value[code] },
    data: points.value.map(point => point.values[code])
  }))
}))
</script>

<template>
  <el-card class="yield-family-chart" shadow="never" :body-style="{ padding: '4px 4px 8px' }">
    <template #header>
      <div class="yield-family-chart__header">
        <span class="yield-family-chart__title">
          獲利收益率
          <el-tooltip :content="INFO_TEXT" placement="top" :popper-style="{ maxWidth: '280px' }">
            <el-icon class="yield-family-chart__info"><InfoFilled /></el-icon>
          </el-tooltip>
        </span>
        <SharedLookbackWindowSelect v-model="activeTab" :disabled-years="disabledYears" />
      </div>
    </template>

    <el-empty v-if="!history.pending.value && !hasAnyData" description="這檔股票尚無歷史資料，可能尚未排入資料回填" :image-size="64" />
    <template v-else-if="gaugeStatsByMetric.earningsYield && gaugeStatsByMetric.fcfYield">
      <SharedPercentileGaugeExpand
        :expanded="chartExpanded"
        :show-toggle="false"
        :loading="history.pending.value"
        :current="gaugeStatsByMetric.earningsYield.current"
        :min="gaugeStatsByMetric.earningsYield.min"
        :max="gaugeStatsByMetric.earningsYield.max"
        :value-text="`盈餘收益率 ${formatPercent(gaugeStatsByMetric.earningsYield.current)}`"
        :percentile-text="`${activeTab}第${Math.round(gaugeStatsByMetric.earningsYield.currentPercentile)}百分位・${gaugeBandLabel(gaugeStatsByMetric.earningsYield)}`"
        :format-scale-value="formatPercent"
        :gradient-from="priceColors.down"
        :gradient-to="priceColors.up"
      />
      <SharedPercentileGaugeExpand
        v-model:expanded="chartExpanded"
        :loading="history.pending.value"
        :current="gaugeStatsByMetric.fcfYield.current"
        :min="gaugeStatsByMetric.fcfYield.min"
        :max="gaugeStatsByMetric.fcfYield.max"
        :value-text="`自由現金流殖利率 ${formatPercent(gaugeStatsByMetric.fcfYield.current)}`"
        :percentile-text="`${activeTab}第${Math.round(gaugeStatsByMetric.fcfYield.currentPercentile)}百分位・${gaugeBandLabel(gaugeStatsByMetric.fcfYield)}`"
        :format-scale-value="formatPercent"
        :gradient-from="priceColors.down"
        :gradient-to="priceColors.up"
        expand-label="展開看歷史走勢"
        collapse-label="收合走勢圖"
      >
        <VChart v-loading="history.pending.value" class="yield-family-chart__chart" :option="option" :init-options="{ renderer: 'svg' }" autoresize />
        <SharedDataFreshnessNote source-label="公開發行公司財務報表" :as-of="latestPoint?.label ?? null" />
      </SharedPercentileGaugeExpand>
    </template>
    <el-empty v-else description="資料不足以計算歷史分位，可能尚未累積足夠期數" :image-size="64" />
  </el-card>
</template>

<style scoped>
.yield-family-chart {
  border-radius: 12px;
}

.yield-family-chart__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.yield-family-chart__title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.yield-family-chart__info {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  cursor: help;
}

.yield-family-chart__chart {
  height: 260px;
  width: 100%;
}
</style>
