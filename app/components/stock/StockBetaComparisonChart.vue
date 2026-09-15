<script setup lang="ts">
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { InfoFilled } from '@element-plus/icons-vue'
import type { LookbackWindow } from '~/utils/lookback-window'
import type { StockBetaWindow } from '~/composables/stock/useStockBeta'

use([CanvasRenderer, LineChart, GridComponent, LegendComponent, TooltipComponent])

// 30-char strict cap (standing rule, see feedback_info_text_30_char_limit memory).
const INFO_TEXT = '個股與大盤同基期100比較，非本益比'

// Beta's "公司股價 vs 大盤走勢對照" chart, rebuilt 2026-09-14 once bff-ts's
// GET /market/taiex-daily-price proxy went live (see useStockCards.ts's own comment for the
// removal/rebuild history — the earlier StockMarketValuationInfoCard.vue tile version was
// deleted outright per direct request before this endpoint existed).
//
// Two price series live on wildly different absolute scales (e.g. a NT$600 stock vs a ~17,000-
// point TAIEX), so a shared-axis raw-price overlay would be unreadable — both series are rebased
// to 100 at the first shared window date instead, same "indexed to 100" convention as every
// finance site's own stock-vs-benchmark chart. This is a visual co-movement chart, NOT the beta
// coefficient itself — the actual coefficient (analysis-ts's own real 'beta' metric, a
// rollingWindow value with 3 fixed (lookbackRange, samplingInterval) combos) is wired in
// separately below via useStockBeta.ts, added 2026-09-14 once bff-ts's own GET
// /stocks/:symbol/beta proxy went live — shown as a small stat row above the chart rather than
// folded into the chart itself, since a single coefficient number isn't a time series.
const props = defineProps<{
  symbol: string
  name: string
}>()

const symbolRef = computed(() => props.symbol)
// Title uses the company's own name, not "個股" — per direct request 2026-09-14
// ("卡片名稱要用該公司名稱 比如 台積電股價 vs 加權指數").
const cardTitle = computed(() => `${props.name}股價 vs 加權指數`)
const activeTab = ref<LookbackWindow>('近5年')
const dailyLimit = ref(2000)

const { data: stockDaily, pending: stockPending } = useDailyPriceHistory(symbolRef, dailyLimit)
const { data: taiexDaily, pending: taiexPending } = useTaiexDailyPrice(dailyLimit)

const pending = computed(() => stockPending.value || taiexPending.value)

// Beta coefficient stat row — 3 fixed windows, each at analysis-ts's own required sampling
// interval (1Y uses daily data, 2Y weekly, 5Y monthly; not a free choice, see betaDefinition.ts).
const { data: betaData } = useStockBeta(symbolRef)
const BETA_WINDOW_LABELS: Record<StockBetaWindow['timeframe'], string> = {
  '1Y_1D': '近1年（日）',
  '2Y_1W': '近2年（週）',
  '5Y_1M': '近5年（月）'
}
const betaStats = computed(() => {
  const windows = betaData.value?.windows ?? []
  return windows.map(window => ({
    label: BETA_WINDOW_LABELS[window.timeframe],
    value: window.value
  }))
})
const hasAnyBeta = computed(() => betaStats.value.some(stat => stat.value !== null))

// Same "month-end close" collapse StockPriceRevenueChart.vue uses — both series are daily but
// on possibly-different actual trading-day sets (TAIEX vs a single symbol's own halts/holidays),
// so matching by CALENDAR MONTH rather than exact trade date avoids either series silently
// dropping points the other lacks.
function monthEndClose(entries: { tradeDate: string; close: number | null }[] | null, yearMonth: string): number | null {
  if (!entries) return null
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i]!
    if (entry.tradeDate.startsWith(yearMonth)) return entry.close
  }
  return null
}

function monthsBack(count: number): string[] {
  const months: string[] = []
  const now = new Date()
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

interface Point {
  label: string
  stockClose: number | null
  taiexClose: number | null
}

const rawPoints = computed<Point[]>(() => {
  const windowSize = LOOKBACK_WINDOW_YEARS[activeTab.value] * 12
  return monthsBack(windowSize).map(yearMonth => ({
    label: yearMonth,
    stockClose: monthEndClose(stockDaily.value, yearMonth),
    taiexClose: monthEndClose(taiexDaily.value, yearMonth)
  }))
})

// ~250 trading days/year — same rough conversion the original 近10年 threshold used (250×8).
const disabledYears = computed(() => {
  const stockCount = stockDaily.value?.length ?? 0
  const taiexCount = taiexDaily.value?.length ?? 0
  const availableCount = Math.min(stockCount, taiexCount)
  return LOOKBACK_YEARS.filter(years => availableCount < years * 250)
})

// Rebase to the first point where BOTH series have a real close — that shared date becomes the
// 100 baseline, matching how the two lines are meant to be read (co-movement FROM this point).
const points = computed<(Point & { stockIndex: number | null; taiexIndex: number | null })[]>(() => {
  const list = rawPoints.value
  const baseIndex = list.findIndex(point => point.stockClose !== null && point.taiexClose !== null)
  if (baseIndex === -1) return list.map(point => ({ ...point, stockIndex: null, taiexIndex: null }))
  const stockBase = list[baseIndex]!.stockClose!
  const taiexBase = list[baseIndex]!.taiexClose!
  return list.map(point => ({
    ...point,
    stockIndex: point.stockClose !== null ? (point.stockClose / stockBase) * 100 : null,
    taiexIndex: point.taiexClose !== null ? (point.taiexClose / taiexBase) * 100 : null
  }))
})

const hasAnyData = computed(() => points.value.some(point => point.stockIndex !== null || point.taiexIndex !== null))

const latestPoint = computed(() => {
  const list = points.value
  for (let i = list.length - 1; i >= 0; i--) {
    const point = list[i]!
    if (point.stockIndex !== null || point.taiexIndex !== null) return point
  }
  return null
})

const { resolvedMode, market, color: accentColor } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))
const stockLineColor = computed(() => getAccentColor(resolvedMode.value, accentColor.value))
const taiexLineColor = computed(() => getPriceColors(resolvedMode.value, market.value).down)

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
        `<div style="${rowStyle}"><span>${label}</span><strong>${value !== null ? value.toFixed(1) : '資料不足'}</strong></div>`
      return `<div style="font-size:16px;min-width:190px;">
        <div style="font-weight:600;margin-bottom:4px;">${point.label}</div>
        ${row(`${props.name}（指數化）`, point.stockIndex)}
        ${row('加權指數（指數化）', point.taiexIndex)}
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
    name: '指數',
    nameTextStyle: { color: chartInk.value.muted, fontSize: 16 },
    scale: true,
    splitLine: { lineStyle: { color: chartInk.value.gridline, type: 'solid' } },
    axisLabel: { color: chartInk.value.muted, fontSize: 16 }
  },
  series: [
    {
      name: props.name,
      type: 'line',
      showSymbol: true,
      symbolSize: 6,
      lineStyle: { width: 2.5, color: stockLineColor.value },
      itemStyle: { color: stockLineColor.value },
      data: points.value.map(point => point.stockIndex),
      z: 10
    },
    {
      name: '加權指數',
      type: 'line',
      showSymbol: true,
      symbolSize: 6,
      lineStyle: { width: 2, color: taiexLineColor.value },
      itemStyle: { color: taiexLineColor.value },
      data: points.value.map(point => point.taiexIndex)
    }
  ]
}))
</script>

<template>
  <el-card class="beta-comparison-chart" shadow="never" :body-style="{ padding: '4px 4px 8px' }">
    <template #header>
      <div class="beta-comparison-chart__header">
        <span class="beta-comparison-chart__title">
          {{ cardTitle }}
          <el-tooltip :content="INFO_TEXT" placement="top" :popper-style="{ maxWidth: '280px' }">
            <el-icon class="beta-comparison-chart__info"><InfoFilled /></el-icon>
          </el-tooltip>
        </span>
        <SharedLookbackWindowSelect v-model="activeTab" :disabled-years="disabledYears" />
      </div>
    </template>

    <div v-if="hasAnyBeta" class="beta-comparison-chart__beta-stats">
      <div v-for="stat in betaStats" :key="stat.label" class="beta-comparison-chart__beta-stat">
        <span class="beta-comparison-chart__beta-stat-label">{{ stat.label }} Beta</span>
        <span class="beta-comparison-chart__beta-stat-value">{{ stat.value !== null ? stat.value.toFixed(2) : '資料不足' }}</span>
      </div>
    </div>

    <el-empty v-if="!pending && !hasAnyData" description="這檔股票尚無歷史資料，可能尚未排入資料回填" :image-size="64" />
    <template v-else>
      <VChart v-loading="pending" class="beta-comparison-chart__chart" :option="option" autoresize />
      <SharedDataFreshnessNote source-label="證交所／櫃買中心每日收盤價、加權股價指數" :as-of="latestPoint?.label ?? null" />
    </template>
  </el-card>
</template>

<style scoped>
.beta-comparison-chart {
  border-radius: 12px;
}

.beta-comparison-chart__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.beta-comparison-chart__title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.beta-comparison-chart__info {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  cursor: help;
}

.beta-comparison-chart__beta-stats {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding: 0 8px 8px;
}

.beta-comparison-chart__beta-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  flex: 1 1 0;
  min-width: 90px;
  padding: 6px 4px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
}

.beta-comparison-chart__beta-stat-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.beta-comparison-chart__beta-stat-value {
  font-size: 18px;
  font-weight: 600;
}

.beta-comparison-chart__chart {
  height: 260px;
  width: 100%;
}
</style>
