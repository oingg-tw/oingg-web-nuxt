<script setup lang="ts">
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { InfoFilled } from '@element-plus/icons-vue'
import type { DupontBasis } from '~/composables/stock/useDupontHistory'

use([CanvasRenderer, LineChart, GridComponent, LegendComponent, TooltipComponent])

const INFO_TEXT = '杜邦分析將 ROE 拆解為淨利率 × 總資產週轉率 × 權益乘數三個因子，用來判斷獲利能力的來源是本業利潤、資產運用效率、還是財務槓桿。'

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
// Fixed to basis='TTM' — briefly had a 單季/近四季 toggle (2026-09-07), removed same day per
// direct follow-up ("杜邦分析 只給 TTM 週期的選項拿掉") rather than offering a choice this app
// no longer wants exposed. 'TTM' makes equityMultiplier always null (no trailing-four-quarter
// variant of a balance-sheet snapshot exists), so that line/legend entry is always excluded
// (not shown as a flat null series), with a note explaining why.
//
// Dual y-axis: decomposedRoePct/netProfitMarginPct are percentages (left axis), assetTurnover/
// equityMultiplier are multiples (right axis) — plotting all 4 on one axis would flatten the
// smaller-magnitude turnover/multiplier lines to near-invisible next to a ~20% ROE line.
const props = defineProps<{
  symbol: string
}>()

const symbolRef = computed(() => props.symbol)
// Always TTM (see this file's own top comment) — still a ref since useDupontHistory.ts expects
// one, but nothing in this component ever mutates it now.
const basis = ref<DupontBasis>('TTM')

const TAB_OPTIONS = ['近5年', '近10年'] as const
const activeTab = ref<(typeof TAB_OPTIONS)[number]>('近5年')
const limit = computed(() => (activeTab.value === '近5年' ? 20 : 40))

const { data: entries, pending, total } = useDupontHistory(symbolRef, basis, limit)

const tenYearDisabled = computed(() => total.value !== null && total.value <= 20)

const hasAnyData = computed(() => !!entries.value?.some(entry => entry.decomposedRoePct !== null))

function periodLabel(entry: { fiscalYear: number; fiscalQuarter: number }): string {
  return `${entry.fiscalYear} Q${entry.fiscalQuarter}`
}

// All 4 lines use fixed, not theme-linked, colors — unlike StockMetricHistoryChart.vue's
// single ratio line (per direct request "本益比河流圖的線 那條顏色要跟著網站主題色變動"), this
// chart plots multiple lines at once, so tying the main ROE line to the user's theme accent
// risked landing on a color too close to one of the other 2 fixed factor colors depending on
// their choice — confirmed live under the default GOLD theme, where the accent-colored ROE
// line and the fixed gold 資產週轉率 line were nearly indistinguishable ("線的顏色都太近似
// 了"). Picked to stay visually distinct from each other under every theme, not just GOLD.
const ROE_LINE_COLOR = '#5b8ff9'
const ASSET_TURNOVER_COLOR = '#d4a72c'

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
      lineStyle: { width: 2.5, color: ROE_LINE_COLOR },
      itemStyle: { color: ROE_LINE_COLOR },
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
    }
    // No 權益乘數 series — always null on basis='TTM' (see this file's own top comment).
  ]
}))
</script>

<template>
  <el-card class="dupont-chart" shadow="never" :body-style="{ padding: '4px 4px 8px' }">
    <template #header>
      <div class="dupont-chart__header">
        <span class="dupont-chart__title">
          杜邦分析（三因子）
          <el-tooltip :content="INFO_TEXT" placement="top" :popper-style="{ maxWidth: '280px' }">
            <el-icon class="dupont-chart__info"><InfoFilled /></el-icon>
          </el-tooltip>
        </span>
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
    </template>

    <el-empty v-if="!pending && !hasAnyData" description="這檔股票尚無歷史資料，可能尚未排入資料回填" :image-size="64" />
    <VChart v-else v-loading="pending" class="dupont-chart__chart" :option="option" autoresize />
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
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.dupont-chart__info {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  cursor: help;
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

</style>
