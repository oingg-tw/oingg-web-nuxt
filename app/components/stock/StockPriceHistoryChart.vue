<script setup lang="ts">
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { InfoFilled } from '@element-plus/icons-vue'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent])

// 30-char strict cap (standing rule, see feedback_info_text_30_char_limit memory).
const INFO_TEXT = '近期每日收盤價走勢，非即時報價'

// 市場評價 tab card, per direct request ("個股瀏覽 市場評價 幫我加上 股價歷史卡片") — the
// pending daily-price-history build noted earlier this session, now that bff-ts confirmed the
// proxy is live (commit a03d9a8). Genuinely different from StockValuationRiverChart.vue's own
// 股價 line (that one is a Q-basis quarter-end SNAPSHOT via useMetricHistory's 'stockPrice'
// metricCode, one point per quarter) — this is real daily-resolution OHLCV via a dedicated
// endpoint, see useDailyPriceHistory.ts's own comment. Close price only (not a candlestick) —
// matches this app's existing single-line convention for every other price/ratio time series
// (river charts included), not a new visual language just for this one card.
//
// Own lookback control (1個月/3個月/6個月/1年/5年), NOT SharedLookbackWindowSelect — that
// component is hardcoded to the 近5年/近10年 pair used by every quarterly/annual financial-
// statement card; daily price data calls for finer, differently-named windows, so this is a
// separate, purpose-built select rather than stretching that shared component to fit two
// unrelated vocabularies. Trading-day counts (not calendar days) since the API's own `limit` is
// a count of most-recent trading-day entries, not a date range.
const props = defineProps<{
  symbol: string
}>()

const WINDOW_DAYS = {
  '1個月': 21,
  '3個月': 63,
  '6個月': 126,
  '1年': 252,
  '5年': 1260
} as const

type WindowLabel = keyof typeof WINDOW_DAYS

const symbolRef = computed(() => props.symbol)
const activeWindow = ref<WindowLabel>('1年')
const limit = computed(() => WINDOW_DAYS[activeWindow.value])

const history = useDailyPriceHistory(symbolRef, limit)

interface Point {
  timestamp: number
  close: number
}

const points = computed<Point[]>(() =>
  (history.data.value ?? []).map(entry => ({
    timestamp: new Date(entry.tradeDate).getTime(),
    close: entry.close
  }))
)

const hasAnyData = computed(() => points.value.length > 0)

const latestPoint = computed(() => {
  const entries = history.data.value
  return entries && entries.length > 0 ? entries[entries.length - 1]!.tradeDate : null
})

const { resolvedMode } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))
const lineColor = computed(() => getChartAccentGold(resolvedMode.value))

interface AxisTooltipParam {
  value?: [number, number]
}

const option = computed(() => ({
  textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  grid: { left: 8, right: 8, top: 16, bottom: 28, containLabel: true },
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'line', lineStyle: { color: chartInk.value.baseline } },
    appendTo: 'body',
    backgroundColor: CHART_TOOLTIP.backgroundColor,
    borderColor: CHART_TOOLTIP.borderColor,
    textStyle: { color: CHART_TOOLTIP_INK.primary },
    formatter: (params: AxisTooltipParam | AxisTooltipParam[]) => {
      const first = Array.isArray(params) ? params[0] : params
      const value = first?.value
      if (!value) return ''
      const date = new Date(value[0]).toISOString().slice(0, 10)
      return `<div style="font-size:16px;min-width:150px;">
        <div style="font-weight:600;margin-bottom:4px;">${date}</div>
        <div>收盤價：<strong>${value[1].toFixed(2)} 元</strong></div>
      </div>`
    }
  },
  xAxis: {
    type: 'time',
    axisLine: { lineStyle: { color: chartInk.value.baseline } },
    axisTick: { show: false },
    axisLabel: { color: chartInk.value.muted, fontSize: 16 }
  },
  yAxis: {
    type: 'value',
    name: '元',
    nameTextStyle: { color: chartInk.value.muted, fontSize: 16 },
    scale: true,
    splitLine: { lineStyle: { color: chartInk.value.gridline, type: 'solid' } },
    axisLabel: { color: chartInk.value.muted, fontSize: 16 }
  },
  series: [
    {
      name: '收盤價',
      type: 'line',
      showSymbol: false,
      lineStyle: { width: 2, color: lineColor.value },
      itemStyle: { color: lineColor.value },
      data: points.value.map(point => [point.timestamp, point.close])
    }
  ]
}))
</script>

<template>
  <el-card class="price-history-chart" shadow="never">
    <template #header>
      <div class="price-history-chart__header">
        <span class="price-history-chart__title">
          股價歷史
          <el-tooltip :content="INFO_TEXT" placement="top" :popper-style="{ maxWidth: '280px' }">
            <el-icon class="price-history-chart__info"><InfoFilled /></el-icon>
          </el-tooltip>
        </span>
        <el-select v-model="activeWindow" class="price-history-chart__window" size="default">
          <el-option v-for="label in Object.keys(WINDOW_DAYS) as WindowLabel[]" :key="label" :label="label" :value="label" />
        </el-select>
      </div>
    </template>

    <el-empty v-if="!history.pending.value && !hasAnyData" description="這檔股票尚無歷史資料，可能尚未排入資料回填" :image-size="64" />
    <template v-else>
      <VChart v-loading="history.pending.value" class="price-history-chart__chart" :option="option" autoresize />
      <SharedDataFreshnessNote source-label="證交所／櫃買中心每日收盤價" :as-of="latestPoint" />
    </template>
  </el-card>
</template>

<style scoped>
.price-history-chart {
  border-radius: 12px;
}

.price-history-chart__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.price-history-chart__title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.price-history-chart__info {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  cursor: help;
}

.price-history-chart__window {
  width: 110px;
}

.price-history-chart__chart {
  height: 240px;
  width: 100%;
}
</style>
