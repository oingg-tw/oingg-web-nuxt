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
const INFO_TEXT = '配息是否靠真金流，或有買回股票'

// Card 2 of the dividend-quality family (design confirmed directly 2026-09-09) — the 2 TTM-basis
// dividend metrics plotted together as an actual line chart, unlike sibling
// StockDividendStabilityCard.vue's snapshot tiles: dividendCoverageRatio and buybackYield share
// the same periodicity (both TTM), so a shared time axis is meaningful here, same reasoning
// StockRoeCompositionChart.vue already uses for its own 3-line family. dividendCoverageRatio
// (現金流角度的股利保障) answers "is the dividend backed by real free cash flow, not debt/asset
// sales"; buybackYield answers "is the company returning capital via buybacks too, on top of
// cash dividends" — deliberately NOT combined into one number (analysis-ts's own definition note:
// different data sources/frequencies, kept as 2 independent metrics by design).
// shareCountChangeRate is NOT repeated here — StockShareCapitalChart.vue already covers dilution
// checking, no need for a 3rd overlapping card.
const props = defineProps<{
  symbol: string
}>()

const METRIC_CODES = ['dividendCoverageRatio', 'buybackYield']

const symbolRef = computed(() => props.symbol)
const activeTab = ref<'近5年' | '近10年'>('近5年')
const limit = computed(() => (activeTab.value === '近5年' ? 20 : 40))

const history = useMetricsHistory(symbolRef, ref(METRIC_CODES), ref('TTM'), limit)

const tenYearDisabled = computed(() => history.total.value !== null && history.total.value < 40)

interface Point {
  label: string
  coverageRatio: number | null
  buybackYield: number | null
}

function periodLabel(entry: { fiscalYear: number; fiscalQuarter: number }): string {
  return `${entry.fiscalYear} Q${entry.fiscalQuarter}`
}

const points = computed<Point[]>(() =>
  (history.data.value ?? []).map((entry: MetricsHistoryEntry) => ({
    label: periodLabel(entry),
    coverageRatio: entry.values.dividendCoverageRatio?.value ?? null,
    buybackYield: entry.values.buybackYield?.value ?? null
  }))
)

const hasAnyData = computed(() => points.value.some(point => point.coverageRatio !== null || point.buybackYield !== null))

const latestPoint = computed(() => {
  const list = points.value
  for (let i = list.length - 1; i >= 0; i--) {
    const point = list[i]!
    if (point.coverageRatio !== null || point.buybackYield !== null) return point
  }
  return null
})

// Same family visual language as StockRoeCompositionChart.vue — fixed (not theme-accent-linked)
// colors, LIGHT variants darkened for WCAG 1.4.11's 3:1 non-text contrast against the light card
// surface.
const DIVIDEND_COVERAGE_COLORS = {
  DARK: { coverageRatio: '#5b8ff9', buybackYield: '#c792ea' },
  LIGHT: { coverageRatio: '#4984fd', buybackYield: '#b368e5' }
}

const { resolvedMode } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))
const lineColors = computed(() => DIVIDEND_COVERAGE_COLORS[resolvedMode.value])

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
      const row = (label: string, value: number | null, unit: string) =>
        `<div style="${rowStyle}"><span>${label}</span><strong>${value !== null ? `${value.toFixed(2)}${unit}` : '資料不足'}</strong></div>`
      return `<div style="font-size:16px;min-width:180px;">
        <div style="font-weight:600;margin-bottom:4px;">${point.label}</div>
        ${row('股利保障倍數', point.coverageRatio, '倍')}
        ${row('買回殖利率', point.buybackYield, '%')}
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
      name: '%',
      nameTextStyle: { color: chartInk.value.muted, fontSize: 16 },
      scale: true,
      splitLine: { show: false },
      axisLabel: { color: chartInk.value.muted, fontSize: 16 }
    }
  ],
  series: [
    {
      name: '股利保障倍數',
      type: 'line',
      yAxisIndex: 0,
      showSymbol: true,
      symbolSize: 6,
      lineStyle: { width: 2.5, color: lineColors.value.coverageRatio },
      itemStyle: { color: lineColors.value.coverageRatio },
      data: points.value.map(point => point.coverageRatio),
      z: 10
    },
    {
      name: '買回殖利率',
      type: 'line',
      yAxisIndex: 1,
      showSymbol: true,
      symbolSize: 6,
      lineStyle: { width: 2, color: lineColors.value.buybackYield },
      itemStyle: { color: lineColors.value.buybackYield },
      data: points.value.map(point => point.buybackYield)
    }
  ]
}))
</script>

<template>
  <el-card class="dividend-coverage-chart" shadow="never" :body-style="{ padding: '4px 4px 8px' }">
    <template #header>
      <div class="dividend-coverage-chart__header">
        <span class="dividend-coverage-chart__title">
          配息保障與資本配置
          <el-tooltip :content="INFO_TEXT" placement="top" :popper-style="{ maxWidth: '280px' }">
            <el-icon class="dividend-coverage-chart__info"><InfoFilled /></el-icon>
          </el-tooltip>
        </span>
        <SharedLookbackWindowSelect v-model="activeTab" :ten-year-insufficient="tenYearDisabled" />
      </div>
    </template>

    <el-empty v-if="!history.pending.value && !hasAnyData" description="這檔股票尚無配息相關資料" :image-size="64" />
    <template v-else>
      <VChart v-loading="history.pending.value" class="dividend-coverage-chart__chart" :option="option" autoresize />
      <SharedDataFreshnessNote source-label="公開發行公司財務報表" :as-of="latestPoint?.label ?? null" />
    </template>
  </el-card>
</template>

<style scoped>
.dividend-coverage-chart {
  border-radius: 12px;
}

.dividend-coverage-chart__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dividend-coverage-chart__title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.dividend-coverage-chart__info {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  cursor: help;
}

.dividend-coverage-chart__chart {
  height: 260px;
  width: 100%;
}
</style>
