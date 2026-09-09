<script setup lang="ts">
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { InfoFilled } from '@element-plus/icons-vue'
import type { MetricsHistoryEntry } from '~/composables/stock/useMetricsHistory'

use([CanvasRenderer, LineChart, GridComponent, LegendComponent, TooltipComponent])

// 30-char強制上限 (standing rule, see feedback_info_text_30_char_limit memory).
const INFO_TEXT = '毛利率／營益率／淨利率同軸比較'

// 「三率」（毛利率/營業利益率/稅後淨利率）— 台股分析的經典組合，三者都是 % 且都支援 TTM，
// 完全同軸，比照StockRoeCompositionChart.vue 的家族視覺語言疊成一張折線圖（design confirmed
// directly 2026-09-09）。三率同步上升/下降是「量價齊揚/俱跌」的訊號；三率彼此背離（例如毛利率
// 撐住但淨利率下滑）代表費用或業外項目在侵蝕獲利，這正是這張卡存在的意義——把三個數字的
// 相對走勢放在一起看，而不是各自獨立的三張卡。
const props = defineProps<{
  symbol: string
}>()

const METRIC_CODES = ['grossMargin', 'operatingMargin', 'netProfitMargin']

const symbolRef = computed(() => props.symbol)
const activeTab = ref<'近5年' | '近10年'>('近5年')
const limit = computed(() => (activeTab.value === '近5年' ? 20 : 40))

const history = useMetricsHistory(symbolRef, ref(METRIC_CODES), ref('TTM'), limit)

const tenYearDisabled = computed(() => history.total.value !== null && history.total.value < 40)

interface Point {
  label: string
  grossMargin: number | null
  operatingMargin: number | null
  netProfitMargin: number | null
}

function periodLabel(entry: { fiscalYear: number; fiscalQuarter: number }): string {
  return `${entry.fiscalYear} Q${entry.fiscalQuarter}`
}

const points = computed<Point[]>(() =>
  (history.data.value ?? []).map((entry: MetricsHistoryEntry) => ({
    label: periodLabel(entry),
    grossMargin: entry.values.grossMargin?.value ?? null,
    operatingMargin: entry.values.operatingMargin?.value ?? null,
    netProfitMargin: entry.values.netProfitMargin?.value ?? null
  }))
)

const hasAnyData = computed(() =>
  points.value.some(point => point.grossMargin !== null || point.operatingMargin !== null || point.netProfitMargin !== null)
)

const latestPoint = computed(() => {
  const list = points.value
  for (let i = list.length - 1; i >= 0; i--) {
    const point = list[i]!
    if (point.grossMargin !== null || point.operatingMargin !== null || point.netProfitMargin !== null) return point
  }
  return null
})

// Same family visual language as StockRoeCompositionChart.vue — fixed (not theme-accent-linked)
// colors, LIGHT variants darkened for WCAG 1.4.11's 3:1 non-text contrast against the light card
// surface. Ordered gross→operating→net (widest to narrowest margin) with decreasing line weight
// to reinforce that visual hierarchy.
const MARGINS_COLORS = {
  DARK: { grossMargin: '#d4a72c', operatingMargin: '#5b8ff9', netProfitMargin: '#6bc99a' },
  LIGHT: { grossMargin: '#aa841f', operatingMargin: '#4984fd', netProfitMargin: '#268a55' }
}

const { resolvedMode } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))
const lineColors = computed(() => MARGINS_COLORS[resolvedMode.value])

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
        `<div style="${rowStyle}"><span>${label}</span><strong>${value !== null ? `${value.toFixed(2)}%` : '資料不足'}</strong></div>`
      return `<div style="font-size:16px;min-width:170px;">
        <div style="font-weight:600;margin-bottom:4px;">${point.label}</div>
        ${row('毛利率', point.grossMargin)}
        ${row('營業利益率', point.operatingMargin)}
        ${row('稅後淨利率', point.netProfitMargin)}
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
      name: '毛利率',
      type: 'line',
      showSymbol: false,
      smooth: true,
      smoothMonotone: 'x',
      lineStyle: { width: 2.5, color: lineColors.value.grossMargin },
      itemStyle: { color: lineColors.value.grossMargin },
      data: points.value.map(point => point.grossMargin),
      z: 10
    },
    {
      name: '營業利益率',
      type: 'line',
      showSymbol: false,
      smooth: true,
      smoothMonotone: 'x',
      lineStyle: { width: 2, color: lineColors.value.operatingMargin },
      itemStyle: { color: lineColors.value.operatingMargin },
      data: points.value.map(point => point.operatingMargin)
    },
    {
      name: '稅後淨利率',
      type: 'line',
      showSymbol: false,
      smooth: true,
      smoothMonotone: 'x',
      lineStyle: { width: 1.5, color: lineColors.value.netProfitMargin },
      itemStyle: { color: lineColors.value.netProfitMargin },
      data: points.value.map(point => point.netProfitMargin)
    }
  ]
}))
</script>

<template>
  <el-card class="margins-chart" shadow="never" :body-style="{ padding: '4px 4px 8px' }">
    <template #header>
      <div class="margins-chart__header">
        <span class="margins-chart__title">
          三率變化
          <el-tooltip :content="INFO_TEXT" placement="top" :popper-style="{ maxWidth: '280px' }">
            <el-icon class="margins-chart__info"><InfoFilled /></el-icon>
          </el-tooltip>
        </span>
        <SharedLookbackWindowSelect v-model="activeTab" :ten-year-insufficient="tenYearDisabled" />
      </div>
    </template>

    <el-empty v-if="!history.pending.value && !hasAnyData" description="這檔股票尚無歷史資料，可能尚未排入資料回填" :image-size="64" />
    <template v-else>
      <VChart v-loading="history.pending.value" class="margins-chart__chart" :option="option" autoresize />
      <SharedDataFreshnessNote source-label="公開發行公司財務報表" :as-of="latestPoint?.label ?? null" />
    </template>
  </el-card>
</template>

<style scoped>
.margins-chart {
  border-radius: 12px;
}

.margins-chart__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.margins-chart__title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.margins-chart__info {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  cursor: help;
}

.margins-chart__chart {
  height: 260px;
  width: 100%;
}
</style>
