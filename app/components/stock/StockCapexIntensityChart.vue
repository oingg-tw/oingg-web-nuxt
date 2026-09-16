<script setup lang="ts">
import type { LookbackWindow } from '~/utils/lookback-window'
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { InfoFilled } from '@element-plus/icons-vue'
import type { MetricsHistoryEntry } from '~/composables/stock/useMetricsHistory'

use([SVGRenderer, LineChart, GridComponent, TooltipComponent])

// 30-char strict cap (standing rule, see feedback_info_text_30_char_limit memory).
const INFO_TEXT = '資本支出佔營收比重，重不重資產'

// Card 4 of the 營運周轉 family (design confirmed directly 2026-09-10) — capexToRevenue alone
// (%, TTM). Doesn't share a unit with any sibling card in this family (次/天 elsewhere), so it
// gets its own single-metric card rather than being forced into one of the others. Uses
// useMetricsHistory (the multi-metric endpoint) with a single-element metricCodes array rather
// than useMetricHistory (the older single-metric endpoint) — that one's own bff-ts validator
// only accepts a hardcoded enum (eps/peRatio/pbRatio/bvps/stockPrice, confirmed live via curl
// 400) and was never extended to arbitrary metricCodes like this one.
const props = defineProps<{
  symbol: string
}>()

const symbolRef = computed(() => props.symbol)
const activeTab = ref<LookbackWindow>('近5年')
const limit = computed(() => LOOKBACK_WINDOW_YEARS[activeTab.value] * 4)

// Timeframe flipped TTM→Q 2026-09-14 per direct request across all cards ("針對所有卡片，都先幫我
// 改成單季呈現或是預設單季") — 稽核鏈 reasoning, see StockAccrualsQualityChart.vue's own comment
// for the full explanation. capexToRevenue has a real 'Q' field (confirmed via GET /metrics).
const history = useMetricsHistory(symbolRef, ref(['capexToRevenue']), ref('Q'), limit)

const disabledYears = computed(() =>
  LOOKBACK_YEARS.filter(years => history.total.value !== null && history.total.value! < years * 4)
)

interface Point {
  label: string
  capexToRevenue: number | null
}

function periodLabel(entry: { fiscalYear: number; fiscalQuarter: number }): string {
  return `${entry.fiscalYear} Q${entry.fiscalQuarter}`
}

const points = computed<Point[]>(() =>
  (history.data.value ?? []).map((entry: MetricsHistoryEntry) => ({
    label: periodLabel(entry),
    capexToRevenue: entry.values.capexToRevenue?.value ?? null
  }))
)

const hasAnyData = computed(() => points.value.some(point => point.capexToRevenue !== null))

const latestPoint = computed(() => {
  const list = points.value
  for (let i = list.length - 1; i >= 0; i--) {
    const point = list[i]!
    if (point.capexToRevenue !== null) return point
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
        <div>資本支出佔營收比：<strong>${point.capexToRevenue !== null ? `${point.capexToRevenue.toFixed(2)}%` : '資料不足'}</strong></div>
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
      name: '資本支出佔營收比',
      type: 'line',
      showSymbol: true,
      symbolSize: 6,
      lineStyle: { width: 2, color: lineColor.value },
      itemStyle: { color: lineColor.value },
      data: points.value.map(point => point.capexToRevenue)
    }
  ]
}))
</script>

<template>
  <el-card class="capex-intensity-chart" shadow="never">
    <template #header>
      <div class="capex-intensity-chart__header">
        <span class="capex-intensity-chart__title">
          資本支出佔營收比
          <el-tooltip :content="INFO_TEXT" placement="top" :popper-style="{ maxWidth: '280px' }">
            <el-icon class="capex-intensity-chart__info"><InfoFilled /></el-icon>
          </el-tooltip>
        </span>
        <SharedLookbackWindowSelect v-model="activeTab" :disabled-years="disabledYears" />
      </div>
    </template>

    <el-empty v-if="!history.pending.value && !hasAnyData" description="這檔股票尚無歷史資料，可能尚未排入資料回填" :image-size="64" />
    <template v-else>
      <SharedChart v-loading="history.pending.value" class="capex-intensity-chart__chart" :option="option" :init-options="{ renderer: 'svg' }" autoresize />
      <SharedDataFreshnessNote source-label="公開發行公司財務報表" :as-of="latestPoint?.label ?? null" />
    </template>
  </el-card>
</template>

<style scoped>
.capex-intensity-chart {
  border-radius: 12px;
}

.capex-intensity-chart__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.capex-intensity-chart__title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.capex-intensity-chart__info {
  font-size: 0.875rem;
  color: var(--el-text-color-placeholder);
  cursor: help;
}

.capex-intensity-chart__chart {
  height: 15rem;
  width: 100%;
}
</style>
