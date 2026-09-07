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
// Same 單季/近四季 (Q/TTM) toggle as the 3-factor card, same reason equityMultiplier drops
// entirely in TTM mode (balance-sheet snapshot, no trailing-four-quarter variant).
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
// Defaults to TTM per direct request ("杜邦分析預設要用TTM") — same override as
// StockDupontChart.vue's own basis default, see that file's own comment.
const basis = ref<DupontBasis>('TTM')
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

const hasAnyData = computed(() => !!entries.value?.some(entry => entry.dupontExtendedRoePct !== null))

function periodLabel(entry: { fiscalYear: number; fiscalQuarter: number }): string {
  return `${entry.fiscalYear} Q${entry.fiscalQuarter}`
}

const EXTENDED_ROE_COLOR = '#e0575b'
const TAX_BURDEN_COLOR = '#f2994e'
const INTEREST_BURDEN_COLOR = '#f6c344'
const EBIT_MARGIN_COLOR = '#6fcf73'
const ASSET_TURNOVER_COLOR = '#56ccf2'
const EQUITY_MULTIPLIER_COLOR = '#9b8afb'

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
  <el-card class="dupont-extended-chart" shadow="never" :body-style="{ padding: '4px 4px 8px' }">
    <template #header>
      <div class="dupont-extended-chart__header">
        <div class="dupont-extended-chart__header-top">
          <span class="dupont-extended-chart__title">
            杜邦分析（五因子）
            <el-tooltip :content="INFO_TEXT" placement="top" :popper-style="{ maxWidth: '280px' }">
              <el-icon class="dupont-extended-chart__info"><InfoFilled /></el-icon>
            </el-tooltip>
          </span>
          <div class="dupont-extended-chart__tabs">
            <button
              v-for="tab in TAB_OPTIONS"
              :key="tab"
              type="button"
              class="dupont-extended-chart__tab"
              :class="{ 'is-active': tab === activeTab }"
              :disabled="tab === '近10年' && tenYearDisabled"
              :title="tab === '近10年' && tenYearDisabled ? '這檔股票的歷史資料不足10年，目前顯示的已是完整範圍' : undefined"
              @click="activeTab = tab"
            >{{ tab }}</button>
          </div>
        </div>
        <div class="dupont-extended-chart__tabs">
          <button
            v-for="option in BASIS_OPTIONS"
            :key="option.value"
            type="button"
            class="dupont-extended-chart__tab"
            :class="{ 'is-active': option.value === basis }"
            @click="basis = option.value"
          >{{ option.label }}</button>
        </div>
      </div>
    </template>

    <el-empty v-if="!pending && !hasAnyData" description="這檔股票尚無歷史資料，可能尚未排入資料回填" :image-size="64" />
    <VChart v-else v-loading="pending" class="dupont-extended-chart__chart" :option="option" autoresize />

    <p class="dupont-extended-chart__note">
      ROE (五因子拆解) = 稅務負擔 × 利息負擔 × EBIT利潤率 × 總資產週轉率 × 權益乘數；比三因子拆解多拆出稅務與利息負擔對獲利的影響。
      <template v-if="!equityMultiplierVisible">近四季模式下權益乘數無法計算（屬資產負債表時點快照，沒有近四季概念），故不顯示這條線。</template>
    </p>
  </el-card>
</template>

<style scoped>
.dupont-extended-chart {
  border-radius: 12px;
}

.dupont-extended-chart__header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dupont-extended-chart__header-top {
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

.dupont-extended-chart__tabs {
  display: flex;
  gap: 4px;
}

.dupont-extended-chart__tab {
  padding: 2px 10px;
  border-radius: 6px;
  font-size: 16px;
  color: var(--el-text-color-secondary);
  border: 1px solid var(--el-border-color-lighter);
  background: transparent;
  cursor: pointer;
}

.dupont-extended-chart__tab.is-active {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

.dupont-extended-chart__tab:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.dupont-extended-chart__chart {
  height: 280px;
  width: 100%;
}

.dupont-extended-chart__note {
  margin: 8px 0 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
  text-align: center;
}
</style>
