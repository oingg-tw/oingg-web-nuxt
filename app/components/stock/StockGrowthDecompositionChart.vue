<script setup lang="ts">
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { InfoFilled } from '@element-plus/icons-vue'
import type { MetricsHistoryEntry } from '~/composables/stock/useMetricsHistory'

use([CanvasRenderer, LineChart, GridComponent, LegendComponent, TooltipComponent])

// analysis-ts's own suggestion (2026-09-09): compare 淨利成長率/EPS成長率 (or 淨值成長率/
// BVPS成長率) side by side, with shareCountChangeRate as the explanatory bridge. The gap
// between the pair IS the signal, per their own framing: equal → 股本沒變, secondary
// noticeably BELOW primary → 增資稀釋 (grew profit but not per-share), secondary ABOVE primary
// → 減資/買回墊高每股數字. Two sibling cards (kind: 'eps' | 'equity') instantiated separately —
// same pattern as StockValuationRiverChart.vue's own pe/pb — per direct correction earlier the
// same day that these must stay separate cards, not merged into one.
const props = defineProps<{
  symbol: string
  kind: 'eps' | 'equity'
}>()

const KINDS = {
  eps: {
    primaryCode: 'netIncomeGrowthRate',
    primaryLabel: '淨利成長率',
    secondaryCode: 'epsGrowthRate',
    secondaryLabel: 'EPS成長率',
    title: 'EPS 成長分解',
    infoText: '比較淨利與EPS成長率差距，看是否被股本稀釋'
  },
  equity: {
    primaryCode: 'equityGrowthRate',
    primaryLabel: '淨值成長率',
    secondaryCode: 'bvpsGrowthRate',
    secondaryLabel: 'BVPS成長率',
    title: '淨值成長分解',
    infoText: '比較淨值與BVPS成長率差距，看是否被股本稀釋'
  }
} as const satisfies Record<'eps' | 'equity', { primaryCode: string; primaryLabel: string; secondaryCode: string; secondaryLabel: string; title: string; infoText: string }>

const SHARE_CODE = 'shareCountChangeRate'
const SHARE_LABEL = '股本變化率'

const spec = computed(() => KINDS[props.kind])
const metricCodes = computed(() => [spec.value.primaryCode, spec.value.secondaryCode, SHARE_CODE])

const symbolRef = computed(() => props.symbol)
const activeTab = ref<'近5年' | '近10年'>('近5年')
const limit = computed(() => (activeTab.value === '近5年' ? 20 : 40))

const history = useMetricsHistory(symbolRef, metricCodes, ref('Q'), limit)

// Only basis=Q exists for this metric set (confirmed live by bff-ts — "TTM" 400s), so unlike
// every other lookback-window card here, "10 年不足" gates on Q-period count directly rather
// than needing a separate TTM-vs-Q distinction.
const tenYearDisabled = computed(() => history.total.value !== null && history.total.value < 40)

interface Point {
  label: string
  primary: number | null
  secondary: number | null
  shareChange: number | null
}

function periodLabel(entry: { fiscalYear: number; fiscalQuarter: number }): string {
  return `${entry.fiscalYear} Q${entry.fiscalQuarter}`
}

const points = computed<Point[]>(() =>
  (history.data.value ?? []).map((entry: MetricsHistoryEntry) => ({
    label: periodLabel(entry),
    primary: entry.values[spec.value.primaryCode]?.value ?? null,
    secondary: entry.values[spec.value.secondaryCode]?.value ?? null,
    shareChange: entry.values[SHARE_CODE]?.value ?? null
  }))
)

const hasAnyData = computed(() => points.value.some(point => point.primary !== null || point.secondary !== null))

const latestPoint = computed(() => {
  const list = points.value
  for (let i = list.length - 1; i >= 0; i--) {
    const point = list[i]!
    if (point.primary !== null || point.secondary !== null) return point
  }
  return null
})

// Gap-based signal per analysis-ts's own framing — only computed off the LATEST period with
// both values present, shown as a one-line takeaway under the chart rather than making the
// reader work it out from two line positions themselves. A gap under 1pp reads as "沒有實質
// 稀釋/墊高" rather than flagging noise as a signal.
const GAP_THRESHOLD = 1
type GapSignal = { text: string; tone: 'neutral' | 'warning' | 'positive' } | null
const gapSignal = computed<GapSignal>(() => {
  const point = latestPoint.value
  if (!point || point.primary === null || point.secondary === null) return null
  const gap = point.secondary - point.primary
  if (Math.abs(gap) < GAP_THRESHOLD) {
    return { text: `${point.label}：${spec.value.secondaryLabel}與${spec.value.primaryLabel}相近，股本沒有明顯變化`, tone: 'neutral' }
  }
  if (gap < 0) {
    return {
      text: `${point.label}：${spec.value.secondaryLabel}比${spec.value.primaryLabel}低 ${Math.abs(gap).toFixed(1)} 個百分點，可能是股本增加稀釋了每股數字`,
      tone: 'warning'
    }
  }
  return {
    text: `${point.label}：${spec.value.secondaryLabel}比${spec.value.primaryLabel}高 ${gap.toFixed(1)} 個百分點，可能是減資／買回墊高了每股數字`,
    tone: 'positive'
  }
})

// Same family visual language as StockRoeCompositionChart.vue/StockDupontChart.vue — fixed
// (not theme-accent-linked) colors so the 3 lines stay mutually distinct under every accent
// choice, with LIGHT variants darkened along the same hue/saturation for WCAG 1.4.11's 3:1
// non-text contrast against the light card surface.
const GROWTH_DECOMPOSITION_COLORS = {
  DARK: { primary: '#d4a72c', secondary: '#5b8ff9', shareChange: '#c792ea' },
  LIGHT: { primary: '#aa841f', secondary: '#4984fd', shareChange: '#b368e5' }
}

const { resolvedMode } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))
const lineColors = computed(() => GROWTH_DECOMPOSITION_COLORS[resolvedMode.value])

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
      return `<div style="font-size:16px;min-width:190px;">
        <div style="font-weight:600;margin-bottom:4px;">${point.label}</div>
        ${row(spec.value.primaryLabel, point.primary)}
        ${row(spec.value.secondaryLabel, point.secondary)}
        ${row(SHARE_LABEL, point.shareChange)}
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
      name: spec.value.primaryLabel,
      type: 'line',
      showSymbol: true,
      symbolSize: 6,
      lineStyle: { width: 2.5, color: lineColors.value.primary },
      itemStyle: { color: lineColors.value.primary },
      data: points.value.map(point => point.primary),
      z: 10
    },
    {
      name: spec.value.secondaryLabel,
      type: 'line',
      showSymbol: true,
      symbolSize: 6,
      lineStyle: { width: 2.5, color: lineColors.value.secondary },
      itemStyle: { color: lineColors.value.secondary },
      data: points.value.map(point => point.secondary),
      z: 9
    },
    {
      name: SHARE_LABEL,
      type: 'line',
      showSymbol: false,
      lineStyle: { width: 1.5, color: lineColors.value.shareChange, type: 'dashed' },
      itemStyle: { color: lineColors.value.shareChange },
      data: points.value.map(point => point.shareChange)
    }
  ]
}))
</script>

<template>
  <el-card class="growth-decomposition-chart" shadow="never" :body-style="{ padding: '4px 4px 8px' }">
    <template #header>
      <div class="growth-decomposition-chart__header">
        <span class="growth-decomposition-chart__title">
          {{ spec.title }}
          <el-tooltip :content="spec.infoText" placement="top" :popper-style="{ maxWidth: '280px' }">
            <el-icon class="growth-decomposition-chart__info"><InfoFilled /></el-icon>
          </el-tooltip>
        </span>
        <SharedLookbackWindowSelect v-model="activeTab" :ten-year-insufficient="tenYearDisabled" />
      </div>
    </template>

    <el-empty v-if="!history.pending.value && !hasAnyData" description="這檔股票尚無歷史資料，可能尚未排入資料回填" :image-size="64" />
    <template v-else>
      <VChart v-loading="history.pending.value" class="growth-decomposition-chart__chart" :option="option" autoresize />
      <p v-if="gapSignal" class="growth-decomposition-chart__signal" :class="`growth-decomposition-chart__signal--${gapSignal.tone}`">
        {{ gapSignal.text }}
      </p>
      <SharedDataFreshnessNote source-label="公開發行公司財務報表" :as-of="latestPoint?.label ?? null" />
    </template>
  </el-card>
</template>

<style scoped>
.growth-decomposition-chart {
  border-radius: 12px;
}

.growth-decomposition-chart__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.growth-decomposition-chart__title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.growth-decomposition-chart__info {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  cursor: help;
}

.growth-decomposition-chart__chart {
  height: 260px;
  width: 100%;
}

.growth-decomposition-chart__signal {
  margin: 4px 8px 0;
  font-size: 16px;
  line-height: 1.5;
}

.growth-decomposition-chart__signal--neutral {
  color: var(--el-text-color-secondary);
}

.growth-decomposition-chart__signal--warning {
  color: var(--el-color-warning);
}

.growth-decomposition-chart__signal--positive {
  color: var(--el-color-success);
}
</style>
