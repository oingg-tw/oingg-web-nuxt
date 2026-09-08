<script setup lang="ts">
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { InfoFilled } from '@element-plus/icons-vue'
import type { MetricBasis, MetricCode } from '~/composables/stock/useMetricHistory'
import type { DupontBasis } from '~/composables/stock/useDupontHistory'

use([CanvasRenderer, LineChart, GridComponent, LegendComponent, TooltipComponent])

const INFO_TEXT = 'ROE ≈ ROA × 權益乘數：同一個 ROE，可能是資產報酬率真的高，也可能是靠拉高槓桿（權益乘數）撐出來的。三條線畫在一起，比只看 ROE 更容易看出獲利是不是靠借錢堆出來的。'

// Rebuilt from a table into a chart per direct follow-up ("該卡片請幫我做成 圖表 如同杜邦分析，
// 他們是一個家族的卡片") — same family as StockDupontChart.vue/StockDupontExtendedChart.vue,
// so this now shares their visual language (dual y-axis, fixed distinct line colors, TTM-only,
// SharedLookbackWindowSelect) instead of standing out as the one table among charts. Original
// ask ("個股瀏覽 卡片 獲利品質 多做一張表，這個表是把ROE ROA 權益乘數 放在一起看") still holds —
// only the presentation changed, not which 3 numbers are shown together or why (see the
// ROE不能跨產業比較 blog post: ROE ≈ ROA × 權益乘數, an ROE spike with no matching ROA move is
// leverage, not better operations).
//
// ROE/ROA come from analysis-ts's dedicated roe-history/roa-history endpoints (basis=TTM);
// 權益乘數 has no TTM variant (balance-sheet point-in-time snapshot — see useDupontHistory.ts's
// own comment), so it's sourced from a separate basis=Q dupont-history fetch and merged in by
// fiscal quarter — same pattern StockDupontChart.vue already uses for its own 權益乘數 line.
const props = defineProps<{
  symbol: string
}>()

const symbolRef = computed(() => props.symbol)
const activeTab = ref<'近5年' | '近10年'>('近5年')
const limit = computed(() => (activeTab.value === '近5年' ? 20 : 40))

const roe = useMetricHistory(symbolRef, ref<MetricCode>('roe'), ref<MetricBasis>('TTM'), limit)
const roa = useMetricHistory(symbolRef, ref<MetricCode>('roa'), ref<MetricBasis>('TTM'), limit)
const dupont = useDupontHistory(symbolRef, ref<DupontBasis>('Q'), limit)

const pending = computed(() => roe.pending.value || roa.pending.value || dupont.pending.value)
// Disabled unless total actually reaches 40 (a genuine 10 years) — same "不滿十年不給看"
// convention as every other lookback-window card on this page.
const tenYearDisabled = computed(() => roe.total.value !== null && roe.total.value < 40)

interface Point {
  label: string
  roe: number | null
  roa: number | null
  equityMultiplier: number | null
}

function periodLabel(entry: { fiscalYear: number; fiscalQuarter: number }): string {
  return `${entry.fiscalYear} Q${entry.fiscalQuarter}`
}

function byQuarter<T extends { fiscalYear: number; fiscalQuarter: number }>(entries: T[] | null): Map<string, T> {
  return new Map((entries ?? []).map(entry => [periodLabel(entry), entry]))
}

// roe.data anchors the x-axis (same "one fetch drives the period axis, others matched in by
// quarter" shape as StockValuationRiverChart.vue's `points`) — oldest-to-newest left-to-right,
// matching every other chart on this page (unlike the table this replaced, which read
// newest-first).
const points = computed<Point[]>(() => {
  const roaByQuarter = byQuarter(roa.data.value)
  const dupontByQuarter = byQuarter(dupont.data.value)
  return (roe.data.value ?? []).map(entry => {
    const key = periodLabel(entry)
    return {
      label: key,
      roe: entry.value,
      roa: roaByQuarter.get(key)?.value ?? null,
      equityMultiplier: dupontByQuarter.get(key)?.equityMultiplier ?? null
    }
  })
})

const hasAnyData = computed(() => points.value.some(point => point.roe !== null || point.roa !== null || point.equityMultiplier !== null))

const latestPoint = computed(() => {
  const list = points.value
  for (let i = list.length - 1; i >= 0; i--) {
    const point = list[i]!
    if (point.roe !== null || point.roa !== null || point.equityMultiplier !== null) return point
  }
  return null
})

// Same family as StockDupontChart.vue: fixed (not theme-accent-linked) colors so the 3 lines
// stay mutually distinct under every accent choice, with LIGHT variants (darkened along the
// same hue/saturation) since the DARK-only values fail WCAG 1.4.11's 3:1 non-text contrast
// against the light card surface — same fix shape as StockDupontChart.vue's own colors. ROE/
// 權益乘數 reuse that card's own hex values (same metric, same visual identity across the
// family); ROA gets its own new color since it doesn't appear on that chart.
const ROE_COMPOSITION_COLORS = {
  DARK: { roe: '#5b8ff9', roa: '#c792ea', equityMultiplier: '#5ac8c8' },
  LIGHT: { roe: '#4984fd', roa: '#b368e5', equityMultiplier: '#2f9797' }
}

const { resolvedMode } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))
const lineColors = computed(() => ROE_COMPOSITION_COLORS[resolvedMode.value])

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
      return `<div style="font-size:16px;min-width:170px;">
        <div style="font-weight:600;margin-bottom:4px;">${point.label}</div>
        ${row('ROE', point.roe, '%')}
        ${row('ROA', point.roa, '%')}
        ${row('權益乘數（單季）', point.equityMultiplier, '×')}
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
      name: '%',
      nameTextStyle: { color: chartInk.value.muted, fontSize: 16 },
      scale: true,
      splitLine: { lineStyle: { color: chartInk.value.gridline, type: 'solid' } },
      axisLabel: { color: chartInk.value.muted, fontSize: 16 }
    },
    {
      type: 'value',
      name: '倍',
      nameTextStyle: { color: chartInk.value.muted, fontSize: 16 },
      scale: true,
      splitLine: { show: false },
      axisLabel: { color: chartInk.value.muted, fontSize: 16 }
    }
  ],
  series: [
    {
      name: 'ROE',
      type: 'line',
      yAxisIndex: 0,
      showSymbol: false,
      smooth: true,
      smoothMonotone: 'x',
      lineStyle: { width: 2.5, color: lineColors.value.roe },
      itemStyle: { color: lineColors.value.roe },
      data: points.value.map(point => point.roe),
      z: 10
    },
    {
      name: 'ROA',
      type: 'line',
      yAxisIndex: 0,
      showSymbol: false,
      smooth: true,
      smoothMonotone: 'x',
      lineStyle: { width: 1.5, color: lineColors.value.roa },
      itemStyle: { color: lineColors.value.roa },
      data: points.value.map(point => point.roa)
    },
    {
      // Label says 單季 explicitly — ROE/ROA above are TTM, this one alone is quarterly out of
      // necessity (see this file's own top comment), not something a reader should assume
      // matches the other two lines' basis.
      name: '權益乘數（單季）',
      type: 'line',
      yAxisIndex: 1,
      showSymbol: false,
      smooth: true,
      smoothMonotone: 'x',
      lineStyle: { width: 1.5, color: lineColors.value.equityMultiplier, type: 'dashed' },
      itemStyle: { color: lineColors.value.equityMultiplier },
      data: points.value.map(point => point.equityMultiplier)
    }
  ]
}))
</script>

<template>
  <el-card class="roe-composition-chart" shadow="never" :body-style="{ padding: '4px 4px 8px' }">
    <template #header>
      <div class="roe-composition-chart__header">
        <span class="roe-composition-chart__title">
          ROE 拆解對照
          <el-tooltip :content="INFO_TEXT" placement="top" :popper-style="{ maxWidth: '280px' }">
            <el-icon class="roe-composition-chart__info"><InfoFilled /></el-icon>
          </el-tooltip>
        </span>
        <SharedLookbackWindowSelect v-model="activeTab" :ten-year-insufficient="tenYearDisabled" />
      </div>
    </template>

    <el-empty v-if="!pending && !hasAnyData" description="這檔股票尚無歷史資料，可能尚未排入資料回填" :image-size="64" />
    <template v-else>
      <VChart v-loading="pending" class="roe-composition-chart__chart" :option="option" autoresize />
      <SharedDataFreshnessNote source-label="公開發行公司財務報表" :as-of="latestPoint?.label ?? null" />
    </template>
  </el-card>
</template>

<style scoped>
.roe-composition-chart {
  border-radius: 12px;
}

.roe-composition-chart__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.roe-composition-chart__title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.roe-composition-chart__info {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  cursor: help;
}

.roe-composition-chart__chart {
  height: 260px;
  width: 100%;
}
</style>
