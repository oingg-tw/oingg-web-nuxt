<script setup lang="ts">
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, MarkLineComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { InfoFilled } from '@element-plus/icons-vue'
import type { MetricsHistoryEntry } from '~/composables/stock/useMetricsHistory'
import type { LookbackWindow } from '~/utils/lookback-window'

use([SVGRenderer, LineChart, GridComponent, TooltipComponent, MarkLineComponent])

// 30-char strict cap (standing rule, see feedback_info_text_30_char_limit memory).
const INFO_TEXT = '殖利率+股利五年成長率，存股社群法則'

// 股東回饋 tab's time-series companion to the Chowder Number guru badge (see guru-badges.ts's
// own 'chowder-number' entry) — same "badge shows only the latest snapshot, chart shows the
// trend" reasoning as StockSueChart.vue's own comment. FY-only timeframe, per analysis-ts's own
// chowderNumberDefinition.ts (no TTM/Q variant exists for this metric). A single 12% mark-line
// mirrors the badge's own community-convention threshold (this app can't tell utilities apart
// from other sectors to apply their looser 8% convention, same caveat as the badge itself).
const props = defineProps<{
  symbol: string
}>()

const symbolRef = computed(() => props.symbol)
const activeTab = ref<LookbackWindow>('近5年')
// FY timeframe = 1 period/year, unlike every other quarterly-cadence card here — limit is years
// directly, no ×4 multiplier.
const limit = computed(() => LOOKBACK_WINDOW_YEARS[activeTab.value])

const history = useMetricsHistory(symbolRef, ref(['chowderNumber']), ref('FY'), limit)

const disabledYears = computed(() =>
  LOOKBACK_YEARS.filter(years => history.total.value !== null && history.total.value! < years)
)

interface Point {
  label: string
  chowderNumber: number | null
}

function periodLabel(entry: { fiscalYear: number }): string {
  return `${entry.fiscalYear}`
}

const points = computed<Point[]>(() =>
  (history.data.value ?? []).map((entry: MetricsHistoryEntry) => ({
    label: periodLabel(entry),
    chowderNumber: entry.values.chowderNumber?.value ?? null
  }))
)

const hasAnyData = computed(() => points.value.some(point => point.chowderNumber !== null))

const latestPoint = computed(() => {
  const list = points.value
  for (let i = list.length - 1; i >= 0; i--) {
    const point = list[i]!
    if (point.chowderNumber !== null) return point
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
      return `<div style="font-size: 1rem;min-width:150px;">
        <div style="font-weight:600;margin-bottom:4px;">${point.label}</div>
        <div>Chowder Number：<strong>${point.chowderNumber !== null ? `${point.chowderNumber.toFixed(2)}%` : '資料不足'}</strong></div>
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
      name: 'Chowder Number',
      type: 'line',
      showSymbol: true,
      symbolSize: 6,
      lineStyle: { width: 2, color: lineColor.value },
      itemStyle: { color: lineColor.value },
      data: points.value.map(point => point.chowderNumber),
      markLine: {
        symbol: 'none',
        silent: true,
        label: { color: chartInk.value.muted, fontSize: 16 },
        lineStyle: { color: chartInk.value.gridline, type: 'dashed' },
        data: [{ yAxis: 12, name: '社群慣例門檻 12%' }]
      }
    }
  ]
}))
</script>

<template>
  <el-card class="chowder-number-chart" shadow="never">
    <template #header>
      <div class="chowder-number-chart__header">
        <span class="chowder-number-chart__title">
          Chowder Number（存股評分）
          <el-tooltip :content="INFO_TEXT" placement="top" :popper-style="{ maxWidth: '280px' }">
            <el-icon class="chowder-number-chart__info"><InfoFilled /></el-icon>
          </el-tooltip>
        </span>
        <SharedLookbackWindowSelect v-model="activeTab" :disabled-years="disabledYears" />
      </div>
    </template>

    <el-empty v-if="!history.pending.value && !hasAnyData" description="這檔股票尚無歷史資料，可能尚未排入資料回填" :image-size="64" />
    <template v-else>
      <VChart v-loading="history.pending.value" class="chowder-number-chart__chart" :option="option" :init-options="{ renderer: 'svg' }" autoresize />
      <SharedDataFreshnessNote source-label="公開發行公司財務報表" :as-of="latestPoint?.label ?? null" />
    </template>
  </el-card>
</template>

<style scoped>
.chowder-number-chart {
  border-radius: 12px;
}

.chowder-number-chart__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.chowder-number-chart__title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.chowder-number-chart__info {
  font-size: 0.875rem;
  color: var(--el-text-color-placeholder);
  cursor: help;
}

.chowder-number-chart__chart {
  height: 240px;
  width: 100%;
}
</style>
