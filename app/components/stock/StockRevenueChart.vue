<script setup lang="ts">
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { InfoFilled } from '@element-plus/icons-vue'

use([CanvasRenderer, BarChart, LineChart, GridComponent, LegendComponent, TooltipComponent])

// bff-ts's GET /stocks/:symbol/monthly-revenue-history (confirmed live 2026-09-07, proxying
// analysis-ts's one-time manual backfill — see useMonthlyRevenueHistory.ts's own comment for
// why this won't grow new months/symbols on its own). Replaces the StockChartShell placeholder
// stock/[code].vue previously showed here. Old StockRevenueChart.vue expected a mocked
// MonthlyRevenue shape (month/revenue/yoy from useStockDetail.ts) no endpoint ever backed —
// rewritten against the real response rather than adapted, same as every other chart card this
// batch (StockMetricHistoryChart.vue etc).
const props = defineProps<{
  symbol: string
  infoText?: string
}>()

const symbolRef = computed(() => props.symbol)
const { data: allEntries, pending } = useMonthlyRevenueHistory(symbolRef)

// Same 近5年/近10年 convention as the quarterly charts (StockMetricHistoryChart.vue etc), just
// counted in months (60/120) instead of quarters (20/40) — but sliced client-side from the one
// already-fetched array rather than refetched per tab, see useMonthlyRevenueHistory.ts's own
// comment for why this endpoint doesn't support that the same way.
const TAB_OPTIONS = ['近5年', '近10年'] as const
const activeTab = ref<(typeof TAB_OPTIONS)[number]>('近5年')
const tenYearDisabled = computed(() => (allEntries.value?.length ?? 0) <= 60)

const entries = computed(() => {
  const all = allEntries.value ?? []
  const windowSize = activeTab.value === '近5年' ? 60 : 120
  return all.slice(-windowSize)
})

const hasAnyData = computed(() => entries.value.length > 0)

// Amount fields arrive as bigint-serialized strings in NT$ thousand (see
// useMonthlyRevenueHistory.ts's own comment) — 1億元 = 100,000 千元.
function toYi(raw: string): number {
  return Number(raw) / 100_000
}

// Bar color follows the same sign-diverging convention as StockMetricHistoryChart.vue's EPS
// bars (up/down per the user's market-convention/theme choice), keyed off yoyChangePercent
// (a revenue decline reads as "down") rather than the revenue level itself, which is never
// negative and so would always render as one flat color.
const { resolvedMode, market } = useAppTheme()
const priceColors = computed(() => getPriceColors(resolvedMode.value, market.value))

function periodLabel(entry: { yearMonth: string }): string {
  return entry.yearMonth
}

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
    axisPointer: { type: 'shadow' },
    appendTo: 'body',
    backgroundColor: CHART_TOOLTIP.backgroundColor,
    borderColor: CHART_TOOLTIP.borderColor,
    textStyle: { color: CHART_INK.primary },
    formatter: (params: AxisTooltipParam | AxisTooltipParam[]) => {
      const list = Array.isArray(params) ? params : [params]
      const dataIndex = list[0]?.dataIndex ?? 0
      const entry = entries.value[dataIndex]
      if (!entry) return ''
      const rowStyle = 'display:flex;justify-content:space-between;gap:16px;padding:2px 0;'
      const row = (label: string, value: string) =>
        `<div style="${rowStyle}"><span>${label}</span><strong>${value}</strong></div>`
      const pct = (value: number | null) => (value !== null ? `${value > 0 ? '+' : ''}${value.toFixed(2)}%` : '資料不足')
      const noteRow = entry.note !== null
        ? `<div style="${rowStyle}color:${CHART_INK.secondary};"><span>公司說明</span><strong>${entry.note}</strong></div>`
        : ''
      return `<div style="font-size:12px;min-width:170px;">
        <div style="font-weight:600;margin-bottom:4px;">${periodLabel(entry)}</div>
        ${row('月營收', `${toYi(entry.currentMonthRevenue).toFixed(1)} 億元`)}
        ${row('年增率', pct(entry.yoyChangePercent))}
        ${row('月增率', pct(entry.momChangePercent))}
        ${row('累計營收年增率', pct(entry.cumulativeChangePercent))}
        ${noteRow}
      </div>`
    }
  },
  xAxis: {
    type: 'category',
    data: entries.value.map(periodLabel),
    axisLine: { lineStyle: { color: CHART_INK.baseline } },
    axisTick: { show: false },
    axisLabel: { color: CHART_INK.muted, fontSize: 11 }
  },
  yAxis: [
    {
      type: 'value',
      name: '億元',
      nameTextStyle: { color: CHART_INK.muted, fontSize: 11 },
      scale: true,
      splitLine: { lineStyle: { color: CHART_INK.gridline, type: 'solid' } },
      axisLabel: { color: CHART_INK.muted, fontSize: 11 }
    },
    {
      type: 'value',
      name: '年增率 %',
      nameTextStyle: { color: CHART_INK.muted, fontSize: 11 },
      scale: true,
      splitLine: { show: false },
      axisLabel: { color: CHART_INK.muted, fontSize: 11, formatter: '{value}%' }
    }
  ],
  series: [
    {
      name: '月營收',
      type: 'bar',
      yAxisIndex: 0,
      barMaxWidth: 24,
      data: entries.value.map(entry => ({
        value: toYi(entry.currentMonthRevenue),
        itemStyle: {
          color: entry.yoyChangePercent < 0 ? priceColors.value.down : priceColors.value.up,
          borderRadius: [4, 4, 0, 0]
        }
      }))
    },
    {
      name: '年增率',
      type: 'line',
      yAxisIndex: 1,
      showSymbol: false,
      smooth: true,
      smoothMonotone: 'x',
      lineStyle: { width: 2, color: CHART_INK.primary },
      itemStyle: { color: CHART_INK.primary },
      markLine: {
        symbol: 'none',
        silent: true,
        label: { show: false },
        lineStyle: { color: CHART_INK.baseline, type: 'dashed', width: 1 },
        data: [{ yAxis: 0 }]
      },
      data: entries.value.map(entry => entry.yoyChangePercent),
      z: 10
    }
  ]
}))
</script>

<template>
  <el-card class="revenue-card" shadow="never" :body-style="{ padding: '4px 4px 8px' }">
    <template #header>
      <div class="revenue-card__header">
        <span class="revenue-card__title">
          月營收與年增率
          <el-tooltip v-if="infoText" :content="infoText" placement="top" :popper-style="{ maxWidth: '280px' }">
            <el-icon class="revenue-card__info"><InfoFilled /></el-icon>
          </el-tooltip>
        </span>
        <div class="revenue-card__tabs">
          <button
            v-for="tab in TAB_OPTIONS"
            :key="tab"
            type="button"
            class="revenue-card__tab"
            :class="{ 'is-active': tab === activeTab }"
            :disabled="tab === '近10年' && tenYearDisabled"
            :title="tab === '近10年' && tenYearDisabled ? '這檔股票的歷史資料不足10年，目前顯示的已是完整範圍' : undefined"
            @click="activeTab = tab"
          >{{ tab }}</button>
        </div>
      </div>
    </template>

    <el-empty v-if="!pending && !hasAnyData" description="這檔股票尚無歷史資料，可能尚未排入資料回填" :image-size="64" />
    <VChart v-else v-loading="pending" class="revenue-card__chart" :option="option" autoresize />
  </el-card>
</template>

<style scoped>
.revenue-card {
  border-radius: 12px;
}

.revenue-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.revenue-card__title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.revenue-card__info {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  cursor: help;
}

.revenue-card__tabs {
  display: flex;
  gap: 4px;
}

.revenue-card__tab {
  padding: 2px 10px;
  border-radius: 6px;
  font-size: 16px;
  color: var(--el-text-color-secondary);
  border: 1px solid var(--el-border-color-lighter);
  background: transparent;
  cursor: pointer;
}

.revenue-card__tab.is-active {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

.revenue-card__tab:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.revenue-card__chart {
  height: 260px;
  width: 100%;
}
</style>
