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

// analysis-ts's own suggestion (2026-09-09): compare 淨利成長率/EPS成長率 (or 淨值成長率/
// BVPS成長率) side by side, with shareCountChangeRate as the explanatory bridge. The gap
// between the pair IS the signal, per their own framing: equal → 股本沒變, secondary
// noticeably BELOW primary → 增資稀釋 (grew profit but not per-share), secondary ABOVE primary
// → 減資/買回墊高每股數字. Two sibling cards (kind: 'eps' | 'equity') instantiated separately —
// same pattern as StockValuationRiverChart.vue's own pe/pb — per direct correction earlier the
// same day that these must stay separate cards, not merged into one.
//
// shareCountChangeRate (the "bridge" explaining the gap) stopped being plotted as a 3rd line
// 2026-09-14, per the 高齡友善圖表類型可用性分級與選型決策框架 the user shared that day (line
// charts capped at ≤2) — it's still visible per-period in the tooltip, just not as its own line.
//
// A `gapSignal` sentence used to interpret the primary/secondary gap ("可能是股本增加稀釋了每股
// 數字" etc.) using a self-defined 1-percentage-point threshold, removed entirely the same day
// per direct correction ("不能說相差 1% 百分點，那是我們自己訂的門檻，我們只能忠實呈現數字") —
// GAP_THRESHOLD was never a value analysis-ts or any cited methodology set, it was invented here
// to decide when a gap counts as "real," which crossed into exactly the kind of interpretive
// judgment this app's own non-advisory boundary (投顧法第4條安全港) doesn't get to make on a
// number it didn't set the meaning of. The tooltip's own raw primary/secondary/shareChange values
// are the only presentation of this data now — faithful numbers, no derived interpretation.
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
const activeTab = ref<LookbackWindow>('近5年')
const limit = computed(() => LOOKBACK_WINDOW_YEARS[activeTab.value] * 4)

const history = useMetricsHistory(symbolRef, metricCodes, ref('Q'), limit)

// Only timeframe=Q exists for this metric set (confirmed live by bff-ts — "TTM" 400s), so unlike
// every other lookback-window card here, "10 年不足" gates on Q-period count directly rather
// than needing a separate TTM-vs-Q distinction.
const disabledYears = computed(() =>
  LOOKBACK_YEARS.filter(years => history.total.value !== null && history.total.value! < years * 4)
)

interface Point {
  label: string
  primary: number | null
  secondary: number | null
  secondaryNullReason: string | null
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
    secondaryNullReason: entry.values[spec.value.secondaryCode]?.nullReason ?? null,
    shareChange: entry.values[SHARE_CODE]?.value ?? null
  }))
)

const hasAnyData = computed(() => points.value.some(point => point.primary !== null || point.secondary !== null))

// Real structural data gap confirmed live by analysis-ts 2026-09-14 (reported live: "EPS 成長
// 分解 只看到一條線 為什麼") — epsGrowthRate/bvpsGrowthRate additionally depend on 流通股數
// (getPaidInSharesAsOf, sourced from 股本變動申報), while netIncomeGrowthRate/equityGrowthRate
// don't need share count at all. A company missing that share-count data source gets a real
// value on the primary line and a permanent nullReason=missing_input on the secondary line —
// per analysis-ts, this is NOT a temporary backfill-progress gap (netIncomeGrowthRate: 1811
// companies covered vs epsGrowthRate: 1219, equityGrowthRate: 2056 vs bvpsGrowthRate: 1385, as
// of 2026Q2) and won't self-resolve, so this needs its own explanation rather than just reading
// as "the chart is broken" the way a transient gap might. Checked across every fetched period,
// not just the latest, since a company either has this data source or doesn't — it isn't
// intermittent quarter to quarter.
const secondaryStructurallyMissing = computed(() => {
  const list = points.value
  const hasPrimary = list.some(point => point.primary !== null)
  const hasSecondary = list.some(point => point.secondary !== null)
  const missingInput = list.some(point => point.secondaryNullReason === 'missing_input')
  return hasPrimary && !hasSecondary && missingInput
})

const latestPoint = computed(() => {
  const list = points.value
  for (let i = list.length - 1; i >= 0; i--) {
    const point = list[i]!
    if (point.primary !== null || point.secondary !== null) return point
  }
  return null
})

// Same family visual language as StockRoeCompositionChart.vue/StockDupontChart.vue — fixed
// (not theme-accent-linked) colors so the 2 lines stay mutually distinct under every accent
// choice, with LIGHT variants darkened along the same hue/saturation for WCAG 1.4.11's 3:1
// non-text contrast against the light card surface. No shareChange entry — only 股本變化率
// stopped being plotted 2026-09-14 (see this file's own top comment), color kept for the 2
// remaining plotted lines only.
const GROWTH_DECOMPOSITION_COLORS = {
  DARK: { primary: '#d4a72c', secondary: '#5b8ff9' },
  LIGHT: { primary: '#aa841f', secondary: '#4984fd' }
}

const { resolvedMode } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))
const lineColors = computed(() => GROWTH_DECOMPOSITION_COLORS[resolvedMode.value])

interface AxisTooltipParam {
  dataIndex?: number
}

const option = computed(() => ({
  textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  grid: { left: 8, right: 8, top: 60, bottom: 28, containLabel: true },
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
        <SharedLookbackWindowSelect v-model="activeTab" :disabled-years="disabledYears" />
      </div>
    </template>

    <el-empty v-if="!history.pending.value && !hasAnyData" description="這檔股票尚無歷史資料，可能尚未排入資料回填" :image-size="64" />
    <template v-else>
      <VChart v-loading="history.pending.value" class="growth-decomposition-chart__chart" :option="option" :init-options="{ renderer: 'svg' }" autoresize />
      <p v-if="secondaryStructurallyMissing" class="growth-decomposition-chart__note">
        {{ spec.secondaryLabel }}缺少流通股數資料，暫無法計算，僅顯示{{ spec.primaryLabel }}
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

.growth-decomposition-chart__note {
  margin: 4px 8px 0;
  font-size: 16px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}
</style>
