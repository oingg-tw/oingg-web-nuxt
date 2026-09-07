<script setup lang="ts">
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import type { DupontBasis } from '~/composables/stock/useDupontHistory'

use([CanvasRenderer, LineChart, GridComponent, LegendComponent, TooltipComponent])

// bff-ts's GET /stocks/:symbol/dupont-history (confirmed live 2026-09-07) — standard 3-factor
// DuPont decomposition (decomposedRoePct = netProfitMarginPct × assetTurnover ×
// equityMultiplier), a genuinely different shape from StockMetricHistoryChart.vue's single-
// value series (one entry here bundles all 4 numbers at once), so this is its own component
// rather than another metricCode on that one. Kept as its own 3-factor card even after
// analysis-ts added the extended 5-factor breakdown (dupontTaxBurden/dupontInterestBurden/
// dupontEbitMargin/dupontExtendedRoe) — per direct request, the two live as separate cards
// (see StockDupontExtendedChart.vue) rather than one replacing the other, since the 3-factor
// view is the simpler/more legible one for most users.
//
// 單季/近四季 (Q/TTM) toggle added 2026-09-07 — 'TTM' makes equityMultiplier always null (no
// trailing-four-quarter variant of a balance-sheet snapshot exists), so that line/legend entry
// is excluded entirely when basis is TTM (see equityMultiplierVisible below), not shown as a
// flat null series, with a note explaining why.
//
// Dual y-axis: decomposedRoePct/netProfitMarginPct are percentages (left axis), assetTurnover/
// equityMultiplier are multiples (right axis) — plotting all 4 on one axis would flatten the
// smaller-magnitude turnover/multiplier lines to near-invisible next to a ~20% ROE line.
const props = defineProps<{
  symbol: string
}>()

const symbolRef = computed(() => props.symbol)
const basis = ref<DupontBasis>('Q')
const BASIS_OPTIONS: { value: DupontBasis; label: string }[] = [
  { value: 'Q', label: '單季' },
  { value: 'TTM', label: '近四季' }
]
const equityMultiplierVisible = computed(() => basis.value === 'Q')

const TAB_OPTIONS = ['近5年', '近10年'] as const
const activeTab = ref<(typeof TAB_OPTIONS)[number]>('近5年')
const limit = computed(() => (activeTab.value === '近5年' ? 20 : 40))

const { data: entries, pending, total } = useDupontHistory(symbolRef, basis, limit)

const tenYearDisabled = computed(() => total.value !== null && total.value <= 20)

const hasAnyData = computed(() => !!entries.value?.some(entry => entry.decomposedRoePct !== null))

function periodLabel(entry: { fiscalYear: number; fiscalQuarter: number }): string {
  return `${entry.fiscalYear} Q${entry.fiscalQuarter}`
}

const { resolvedMode, color: accentColor } = useAppTheme()
const roeLineColor = computed(() => getAccentColor(resolvedMode.value, accentColor.value))
// Fixed, not theme-linked — these two are supporting factor lines, not the headline metric the
// direct request ("本益比河流圖的線 那條顏色要跟著網站主題色變動") was actually about.
const ASSET_TURNOVER_COLOR = '#d4a72c'
const EQUITY_MULTIPLIER_COLOR = '#5ac8c8'

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
    textStyle: { color: CHART_INK.secondary, fontSize: 12 }
  },
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'line', lineStyle: { color: CHART_INK.baseline } },
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
      const row = (label: string, value: number | null, unit: string) =>
        `<div style="${rowStyle}"><span>${label}</span><strong>${value !== null ? `${value.toFixed(2)}${unit}` : '資料不足'}</strong></div>`
      return `<div style="font-size:12px;min-width:160px;">
        <div style="font-weight:600;margin-bottom:4px;">${periodLabel(entry)}</div>
        ${row('ROE (拆解)', entry.decomposedRoePct, '%')}
        ${row('淨利率', entry.netProfitMarginPct, '%')}
        ${row('總資產週轉率', entry.assetTurnover, '×')}
        ${equityMultiplierVisible.value ? row('權益乘數', entry.equityMultiplier, '×') : ''}
      </div>`
    }
  },
  xAxis: {
    type: 'category',
    data: (entries.value ?? []).map(periodLabel),
    axisLine: { lineStyle: { color: CHART_INK.baseline } },
    axisTick: { show: false },
    axisLabel: { color: CHART_INK.muted, fontSize: 11 }
  },
  yAxis: [
    {
      type: 'value',
      name: '%',
      nameTextStyle: { color: CHART_INK.muted, fontSize: 11 },
      scale: true,
      splitLine: { lineStyle: { color: CHART_INK.gridline, type: 'solid' } },
      axisLabel: { color: CHART_INK.muted, fontSize: 11 }
    },
    {
      type: 'value',
      name: '倍',
      nameTextStyle: { color: CHART_INK.muted, fontSize: 11 },
      scale: true,
      splitLine: { show: false },
      axisLabel: { color: CHART_INK.muted, fontSize: 11 }
    }
  ],
  series: [
    {
      name: 'ROE (拆解)',
      type: 'line',
      yAxisIndex: 0,
      showSymbol: false,
      smooth: true,
      smoothMonotone: 'x',
      lineStyle: { width: 2.5, color: roeLineColor.value },
      itemStyle: { color: roeLineColor.value },
      data: (entries.value ?? []).map(entry => entry.decomposedRoePct),
      z: 10
    },
    {
      name: '淨利率',
      type: 'line',
      yAxisIndex: 0,
      showSymbol: false,
      smooth: true,
      smoothMonotone: 'x',
      lineStyle: { width: 1.5, color: CHART_INK.secondary, type: 'dashed' },
      itemStyle: { color: CHART_INK.secondary },
      data: (entries.value ?? []).map(entry => entry.netProfitMarginPct)
    },
    {
      name: '總資產週轉率',
      type: 'line',
      yAxisIndex: 1,
      showSymbol: false,
      smooth: true,
      smoothMonotone: 'x',
      lineStyle: { width: 1.5, color: ASSET_TURNOVER_COLOR },
      itemStyle: { color: ASSET_TURNOVER_COLOR },
      data: (entries.value ?? []).map(entry => entry.assetTurnover)
    },
    ...(equityMultiplierVisible.value
      ? [
          {
            name: '權益乘數',
            type: 'line' as const,
            yAxisIndex: 1,
            showSymbol: false,
            smooth: true,
            smoothMonotone: 'x' as const,
            lineStyle: { width: 1.5, color: EQUITY_MULTIPLIER_COLOR },
            itemStyle: { color: EQUITY_MULTIPLIER_COLOR },
            data: (entries.value ?? []).map(entry => entry.equityMultiplier)
          }
        ]
      : [])
  ]
}))
</script>

<template>
  <el-card class="dupont-chart" shadow="never" :body-style="{ padding: '4px 4px 8px' }">
    <template #header>
      <div class="dupont-chart__header">
        <div class="dupont-chart__header-top">
          <span class="dupont-chart__title">杜邦分析 (ROE 拆解)</span>
          <div class="dupont-chart__tabs">
            <button
              v-for="tab in TAB_OPTIONS"
              :key="tab"
              type="button"
              class="dupont-chart__tab"
              :class="{ 'is-active': tab === activeTab }"
              :disabled="tab === '近10年' && tenYearDisabled"
              :title="tab === '近10年' && tenYearDisabled ? '這檔股票的歷史資料不足10年，目前顯示的已是完整範圍' : undefined"
              @click="activeTab = tab"
            >{{ tab }}</button>
          </div>
        </div>
        <div class="dupont-chart__tabs">
          <button
            v-for="option in BASIS_OPTIONS"
            :key="option.value"
            type="button"
            class="dupont-chart__tab"
            :class="{ 'is-active': option.value === basis }"
            @click="basis = option.value"
          >{{ option.label }}</button>
        </div>
      </div>
    </template>

    <el-empty v-if="!pending && !hasAnyData" description="這檔股票尚無歷史資料，可能尚未排入資料回填" :image-size="64" />
    <VChart v-else v-loading="pending" class="dupont-chart__chart" :option="option" autoresize />

    <p class="dupont-chart__note">
      ROE (拆解) = 淨利率 × 總資產週轉率 × 權益乘數；三者相乘即為拆解出的股東權益報酬率。
      <template v-if="!equityMultiplierVisible">近四季模式下權益乘數無法計算（屬資產負債表時點快照，沒有近四季概念），故不顯示這條線。</template>
    </p>
  </el-card>
</template>

<style scoped>
.dupont-chart {
  border-radius: 12px;
}

.dupont-chart__header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dupont-chart__header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dupont-chart__title {
  font-weight: 600;
}

.dupont-chart__tabs {
  display: flex;
  gap: 4px;
}

.dupont-chart__tab {
  padding: 2px 10px;
  border-radius: 6px;
  font-size: 16px;
  color: var(--el-text-color-secondary);
  border: 1px solid var(--el-border-color-lighter);
  background: transparent;
  cursor: pointer;
}

.dupont-chart__tab.is-active {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

.dupont-chart__tab:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.dupont-chart__chart {
  height: 260px;
  width: 100%;
}

.dupont-chart__note {
  margin: 8px 0 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
  text-align: center;
}
</style>
