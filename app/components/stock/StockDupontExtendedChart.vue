<script setup lang="ts">
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { InfoFilled } from '@element-plus/icons-vue'
import type { DupontBasis } from '~/composables/stock/useDupontHistory'

use([CanvasRenderer, LineChart, GridComponent, LegendComponent, TooltipComponent])

const INFO_TEXT = '五因子杜邦分析將三因子中的淨利率進一步拆解為稅務負擔 × 利息負擔 × EBIT利潤率，能更精確區分稅務、利息費用與本業營運對獲利的影響。'

// Extended 5-factor DuPont breakdown — splits StockDupontChart.vue's own 3-factor
// netProfitMarginPct further into 稅務負擔 (tax burden) × 利息負擔 (interest burden) × EBIT
// 利潤率 (EBIT margin), so dupontExtendedRoePct = dupontTaxBurdenPct × dupontInterestBurdenPct
// × dupontEbitMarginPct × assetTurnover × equityMultiplier. Confirmed live to equal
// decomposedRoePct — both derive the same ROE, just decomposed differently.
//
// A separate card, not a mode toggle on StockDupontChart.vue — per direct request ("兩張卡片
// 並存（三因子與五因子分開）") after being asked whether to replace the 3-factor card outright:
// the 3-factor view stays as the simpler/more legible default, this is the deeper-dive option
// for whoever wants it.
//
// Same underlying GET /stocks/:symbol/dupont-history endpoint/composable as
// StockDupontChart.vue (see useDupontHistory.ts's own comment) — one entry already carries
// both the 3-factor and 5-factor fields together, no separate fetch needed. Gates its own
// "data incomplete" state on `dupontExtendedRoeNullReason`, NOT the 3-factor `nullReason` —
// bff-ts confirmed live these two completeness checks are independent and can disagree in edge
// cases (the 5-factor calc needs pre-tax profit/finance costs the 3-factor one doesn't).
//
// Fixed to basis='TTM' — same removal as StockDupontChart.vue's own top comment ("杜邦分析
// 只給 TTM 週期的選項拿掉", 2026-09-07): no more 單季/近四季 toggle, equityMultiplier is
// therefore always excluded (balance-sheet snapshot, no trailing-four-quarter variant), with
// a note explaining why rather than a flat null series.
//
// Triple-line-group dual y-axis: dupontExtendedRoePct/dupontTaxBurdenPct/
// dupontInterestBurdenPct/dupontEbitMarginPct are percentages (left axis), assetTurnover/
// equityMultiplier are multiples (right axis) — same reasoning as the 3-factor card's own
// dual-axis choice. All 6 lines use fixed, mutually distinct colors (not the theme accent) —
// same lesson as StockDupontChart.vue's own color fix ("線的顏色都太近似了，這邊就不要跟主題色
// 了"), applied here from the start rather than repeating that mistake with more lines.
const props = defineProps<{
  symbol: string
}>()

const symbolRef = computed(() => props.symbol)
// Always TTM (see this file's own top comment) — still a ref since useDupontHistory.ts expects
// one, but nothing in this component ever mutates it now.
const basis = ref<DupontBasis>('TTM')

const activeTab = ref<'近5年' | '近10年'>('近5年')
const limit = computed(() => (activeTab.value === '近5年' ? 20 : 40))

const { data: entries, pending, total } = useDupontHistory(symbolRef, basis, limit)

// Disabled unless total actually reaches 40 (a genuine 10 years) — per direct correction
// ("不滿十年不給看"), not just "more than the 20 periods 近5年 already shows".
const tenYearDisabled = computed(() => total.value !== null && total.value < 40)

const hasAnyData = computed(() => !!entries.value?.some(entry => entry.dupontExtendedRoePct !== null))

function periodLabel(entry: { fiscalYear: number; fiscalQuarter: number }): string {
  return `${entry.fiscalYear} Q${entry.fiscalQuarter}`
}

const EXTENDED_ROE_COLOR = '#e0575b'
const TAX_BURDEN_COLOR = '#f2994e'
const INTEREST_BURDEN_COLOR = '#f6c344'
const EBIT_MARGIN_COLOR = '#6fcf73'
const ASSET_TURNOVER_COLOR = '#56ccf2'

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
      return `<div style="font-size:12px;min-width:170px;">
        <div style="font-weight:600;margin-bottom:4px;">${periodLabel(entry)}</div>
        ${row('ROE (五因子拆解)', entry.dupontExtendedRoePct, '%')}
        ${row('稅務負擔', entry.dupontTaxBurdenPct, '%')}
        ${row('利息負擔', entry.dupontInterestBurdenPct, '%')}
        ${row('EBIT利潤率', entry.dupontEbitMarginPct, '%')}
        ${row('總資產週轉率', entry.assetTurnover, '×')}
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
      name: 'ROE (五因子拆解)',
      type: 'line',
      yAxisIndex: 0,
      showSymbol: false,
      smooth: true,
      smoothMonotone: 'x',
      lineStyle: { width: 2.5, color: EXTENDED_ROE_COLOR },
      itemStyle: { color: EXTENDED_ROE_COLOR },
      data: (entries.value ?? []).map(entry => entry.dupontExtendedRoePct),
      z: 10
    },
    {
      name: '稅務負擔',
      type: 'line',
      yAxisIndex: 0,
      showSymbol: false,
      smooth: true,
      smoothMonotone: 'x',
      lineStyle: { width: 1.5, color: TAX_BURDEN_COLOR },
      itemStyle: { color: TAX_BURDEN_COLOR },
      data: (entries.value ?? []).map(entry => entry.dupontTaxBurdenPct)
    },
    {
      name: '利息負擔',
      type: 'line',
      yAxisIndex: 0,
      showSymbol: false,
      smooth: true,
      smoothMonotone: 'x',
      lineStyle: { width: 1.5, color: INTEREST_BURDEN_COLOR },
      itemStyle: { color: INTEREST_BURDEN_COLOR },
      data: (entries.value ?? []).map(entry => entry.dupontInterestBurdenPct)
    },
    {
      name: 'EBIT利潤率',
      type: 'line',
      yAxisIndex: 0,
      showSymbol: false,
      smooth: true,
      smoothMonotone: 'x',
      lineStyle: { width: 1.5, color: EBIT_MARGIN_COLOR },
      itemStyle: { color: EBIT_MARGIN_COLOR },
      data: (entries.value ?? []).map(entry => entry.dupontEbitMarginPct)
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
    }
    // No 權益乘數 series — always null on basis='TTM' (see this file's own top comment).
  ]
}))
</script>

<template>
  <el-card class="dupont-extended-chart" shadow="never" :body-style="{ padding: '4px 4px 8px' }">
    <template #header>
      <div class="dupont-extended-chart__header">
        <span class="dupont-extended-chart__title">
          杜邦分析（五因子）
          <el-tooltip :content="INFO_TEXT" placement="top" :popper-style="{ maxWidth: '280px' }">
            <el-icon class="dupont-extended-chart__info"><InfoFilled /></el-icon>
          </el-tooltip>
        </span>
        <SharedLookbackWindowSelect v-model="activeTab" :ten-year-insufficient="tenYearDisabled" />
      </div>
    </template>

    <el-empty v-if="!pending && !hasAnyData" description="這檔股票尚無歷史資料，可能尚未排入資料回填" :image-size="64" />
    <VChart v-else v-loading="pending" class="dupont-extended-chart__chart" :option="option" autoresize />
  </el-card>
</template>

<style scoped>
.dupont-extended-chart {
  border-radius: 12px;
}

.dupont-extended-chart__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dupont-extended-chart__title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.dupont-extended-chart__info {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  cursor: help;
}

.dupont-extended-chart__chart {
  height: 280px;
  width: 100%;
}
</style>
