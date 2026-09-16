<script setup lang="ts">
import type { LookbackWindow } from '~/utils/lookback-window'
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { InfoFilled } from '@element-plus/icons-vue'
import type { MetricsHistoryEntry } from '~/composables/stock/useMetricsHistory'

use([SVGRenderer, LineChart, GridComponent, TooltipComponent])

// 30-char strict cap (standing rule, see feedback_info_text_30_char_limit memory).
const INFO_TEXT = '毛利率／營益率／淨利率走勢'

// 「三率」（毛利率/營業利益率/稅後淨利率）— 台股分析的經典組合，三者都是 % 且都支援 TTM. 三率
// 同步上升/下降是「量價齊揚/俱跌」的訊號；三率彼此背離（例如毛利率撐住但淨利率下滑）代表費用或
// 業外項目在侵蝕獲利，這正是這張卡存在的意義——把三個數字的相對走勢放在一起看，而不是各自獨立的
// 三張卡。
//
// Rebuilt 2026-09-14 (直接回饋: "毛利率/營業利益率/淨利率跟外資/投信/自營商是同一種結構——都是
// 同一組主題底下的3個子維度，不是跨分類的獨立指標...依既有規則，這種情境維持折線疊圖≤2條的上限，
// 不套用small multiples" 的反向指正——使用者更正為「這個情境正好應該套用small multiples」) from an
// earlier same-day pass that had demoted 營業利益率 to a 2-line 毛利率/稅後淨利率 overlay chart.
// That 2-of-3 demotion pattern fits when one metric is genuinely secondary; here all 3 are equal
// members of one structural breakdown, so per this app's own >2-indicator small-multiples rule
// (see docs' 個股瀏覽頁表格軌 §2.6.2), the fix is 3 independent single-line mini-charts stacked
// vertically instead of forcing 2 of 3 into one overlay — each mini-chart trivially satisfies the
// ≤2-line cap (it only ever has 1 line), and a reader sees all 3 metrics' shapes without ever
// having to trace which segment belongs to which line.
//
// `marginTrendSummary` below states the same "營業利益率下滑侵蝕淨利" relationship the old overlay
// chart made visually explicit, but as a plain objective sentence (from/to values, direction only)
// rather than asking the reader to compare gaps between overlaid lines — no "體質惡化" or other
// evaluative language, matching this app's non-advisory tone (see 投顧法第4條安全港 boundary
// already applied elsewhere in this codebase, e.g. StockGuruBadgeCategoryCard.vue's own color
// choices).
const props = defineProps<{
  symbol: string
}>()

const METRIC_CODES = ['grossMargin', 'operatingMargin', 'netProfitMargin']
type MetricKey = 'grossMargin' | 'operatingMargin' | 'netProfitMargin'

const symbolRef = computed(() => props.symbol)
const activeTab = ref<LookbackWindow>('近5年')
const limit = computed(() => LOOKBACK_WINDOW_YEARS[activeTab.value] * 4)

// Multi-select picker added 2026-09-14, per direct request ("三率變化 希望可以有下拉選單...可以
// 多個勾選。預設顯示 毛利率 與 營業利益率") — each metric still only ever renders as its own
// independent single-line mini-chart (see miniOption's own comment), so showing all 3 at once
// was never actually a ≤2-line-cap violation; this is a pure "how much do I want on screen"
// preference, not a compliance requirement like the earlier overlay-chart remediation pass this
// same file's own top comment documents. Order in the picker (and in the rendered mini-chart
// stack below) is always 毛利率→營業利益率→稅後淨利率 regardless of click order — matches the
// income-statement's own top-to-bottom line order, not "most recently selected first."
const METRIC_OPTIONS: { key: MetricKey; label: string }[] = [
  { key: 'grossMargin', label: '毛利率' },
  { key: 'operatingMargin', label: '營業利益率' },
  { key: 'netProfitMargin', label: '稅後淨利率' }
]
const selectedMetrics = ref<MetricKey[]>(['grossMargin', 'operatingMargin'])
const visibleMetrics = computed(() => METRIC_OPTIONS.filter(option => selectedMetrics.value.includes(option.key)))

// Timeframe flipped TTM→Q 2026-09-14 per direct request across all cards ("針對所有卡片，都先幫我
// 改成單季呈現或是預設單季") — 稽核鏈 reasoning, see StockAccrualsQualityChart.vue's own comment
// for the full explanation. All 3 margin metrics have a real 'Q' field (confirmed via GET /metrics).
const history = useMetricsHistory(symbolRef, ref(METRIC_CODES), ref('Q'), limit)

const disabledYears = computed(() =>
  LOOKBACK_YEARS.filter(years => history.total.value !== null && history.total.value! < years * 4)
)

interface Point {
  label: string
  grossMargin: number | null
  operatingMargin: number | null
  netProfitMargin: number | null
}

function periodLabel(entry: { fiscalYear: number; fiscalQuarter: number }): string {
  return `${entry.fiscalYear} Q${entry.fiscalQuarter}`
}

const points = computed<Point[]>(() =>
  (history.data.value ?? []).map((entry: MetricsHistoryEntry) => ({
    label: periodLabel(entry),
    grossMargin: entry.values.grossMargin?.value ?? null,
    operatingMargin: entry.values.operatingMargin?.value ?? null,
    netProfitMargin: entry.values.netProfitMargin?.value ?? null
  }))
)

const hasAnyData = computed(() =>
  points.value.some(point => point.grossMargin !== null || point.operatingMargin !== null || point.netProfitMargin !== null)
)

const latestPoint = computed(() => {
  const list = points.value
  for (let i = list.length - 1; i >= 0; i--) {
    const point = list[i]!
    if (point.grossMargin !== null || point.operatingMargin !== null || point.netProfitMargin !== null) return point
  }
  return null
})

// Same family visual language as StockRoeCompositionChart.vue — fixed (not theme-accent-linked)
// colors, LIGHT variants darkened for WCAG 1.4.11's 3:1 non-text contrast against the light card
// surface. All 3 back, one per mini-chart, since small multiples has no crowding limit the way
// one shared overlay chart does.
const MARGINS_COLORS = {
  DARK: { grossMargin: '#d4a72c', operatingMargin: '#5b8ff9', netProfitMargin: '#6bc99a' },
  LIGHT: { grossMargin: '#aa841f', operatingMargin: '#4984fd', netProfitMargin: '#268a55' }
}

const { resolvedMode } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))
const lineColors = computed(() => MARGINS_COLORS[resolvedMode.value])

interface AxisTooltipParam {
  dataIndex?: number
}

// One independent single-line option per metric — each satisfies the ≤2-line cap trivially, and
// each y-axis is forced to always include 0 (min/max as functions, not a fixed 0 floor, since
// 稅後淨利率 can genuinely go negative on a loss quarter and clipping that would hide the loss)
// so all 3 mini-charts read on a comparable zero-anchored scale rather than each auto-scaling to
// its own tight range and visually exaggerating small moves.
function miniOption(name: string, color: string, value: (point: Point) => number | null) {
  return {
    textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
    grid: { left: 8, right: 8, top: 8, bottom: 24, containLabel: true },
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
        const v = value(point)
        const rowStyle = 'display:flex;justify-content:space-between;gap:16px;padding:2px 0;'
        return `<div style="font-size: 1rem;min-width:150px;">
          <div style="font-weight:600;margin-bottom:4px;">${point.label}</div>
          <div style="${rowStyle}"><span>${name}</span><strong>${v !== null ? `${v.toFixed(2)}%` : '資料不足'}</strong></div>
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
      min: (extent: { min: number }) => Math.min(0, extent.min),
      max: (extent: { max: number }) => Math.max(0, extent.max),
      splitLine: { lineStyle: { color: chartInk.value.gridline, type: 'solid' } },
      axisLabel: { color: chartInk.value.muted, fontSize: 16 }
    },
    series: [
      {
        name,
        type: 'line',
        showSymbol: true,
        symbolSize: 6,
        smooth: true,
        smoothMonotone: 'x',
        lineStyle: { width: 2.5, color },
        itemStyle: { color },
        data: points.value.map(value),
        z: 10
      }
    ]
  }
}

const METRIC_VALUE_ACCESSORS: Record<MetricKey, (point: Point) => number | null> = {
  grossMargin: point => point.grossMargin,
  operatingMargin: point => point.operatingMargin,
  netProfitMargin: point => point.netProfitMargin
}

const metricOptionsByKey = computed<Record<MetricKey, ReturnType<typeof miniOption>>>(() => ({
  grossMargin: miniOption('毛利率', lineColors.value.grossMargin, METRIC_VALUE_ACCESSORS.grossMargin),
  operatingMargin: miniOption('營業利益率', lineColors.value.operatingMargin, METRIC_VALUE_ACCESSORS.operatingMargin),
  netProfitMargin: miniOption('稅後淨利率', lineColors.value.netProfitMargin, METRIC_VALUE_ACCESSORS.netProfitMargin)
}))

// Objective from→to trend statement per direct request ("摘要句先行...只客觀比較兩個數字的變化
// 方向是否同步，不做評價性結論") — looks back up to TREND_WINDOW periods from the latest period
// that has data, using the earliest non-null value actually found in that window (handles missing
// quarters without producing a misleading span). STABLE_THRESHOLD_PP borrows the same 1-percentage-
// point convention as StockGrowthDecompositionChart.vue's own GAP_THRESHOLD for "no real change."
const TREND_WINDOW = 5
const STABLE_THRESHOLD_PP = 1

interface TrendChange {
  from: number
  to: number
  periodsSpan: number
}

function trendChange(value: (point: Point) => number | null): TrendChange | null {
  const list = points.value
  let toIndex = -1
  for (let i = list.length - 1; i >= 0; i--) {
    if (value(list[i]!) !== null) {
      toIndex = i
      break
    }
  }
  if (toIndex === -1) return null
  const windowStart = Math.max(0, toIndex - (TREND_WINDOW - 1))
  let fromIndex = -1
  for (let i = windowStart; i <= toIndex; i++) {
    if (value(list[i]!) !== null) {
      fromIndex = i
      break
    }
  }
  if (fromIndex === -1 || fromIndex === toIndex) return null
  return { from: value(list[fromIndex]!)!, to: value(list[toIndex]!)!, periodsSpan: toIndex - fromIndex }
}

function verb(diff: number): string {
  if (diff > STABLE_THRESHOLD_PP * 0.01) return '升'
  if (diff < -STABLE_THRESHOLD_PP * 0.01) return '降'
  return '持平'
}

const marginTrendSummary = computed(() => {
  const operating = trendChange(point => point.operatingMargin)
  const net = trendChange(point => point.netProfitMargin)
  if (!operating || !net) return null
  const operatingDiff = operating.to - operating.from
  const netDiff = net.to - net.from
  const sameDirection = (operatingDiff >= 0 && netDiff >= 0) || (operatingDiff <= 0 && netDiff <= 0)
  const periods = Math.max(operating.periodsSpan, net.periodsSpan)
  let text = `近${periods}季營業利益率由 ${operating.from.toFixed(1)}% ${verb(operatingDiff)}至 ${operating.to.toFixed(1)}%，同期稅後淨利率由 ${net.from.toFixed(1)}% ${verb(netDiff)}至 ${net.to.toFixed(1)}%，${sameDirection ? '變動方向一致' : '變動方向不一致'}`

  const gross = trendChange(point => point.grossMargin)
  if (gross) {
    const grossDiff = gross.to - gross.from
    if (Math.abs(grossDiff) < STABLE_THRESHOLD_PP && operatingDiff < -STABLE_THRESHOLD_PP) {
      text += '；毛利率維持穩定，營業利益率降幅主要反映營業費用率上升'
    }
  }
  return text
})
</script>

<template>
  <el-card class="margins-chart" shadow="never" :body-style="{ padding: '4px 4px 8px' }">
    <template #header>
      <div class="margins-chart__header">
        <span class="margins-chart__title">
          三率變化
          <el-tooltip :content="INFO_TEXT" placement="top" :popper-style="{ maxWidth: '280px' }">
            <el-icon class="margins-chart__info"><InfoFilled /></el-icon>
          </el-tooltip>
        </span>
        <div class="margins-chart__header-actions">
          <el-select v-model="selectedMetrics" multiple size="default" class="margins-chart__metric-select" placeholder="選擇指標">
            <el-option v-for="option in METRIC_OPTIONS" :key="option.key" :label="option.label" :value="option.key" />
          </el-select>
          <SharedLookbackWindowSelect v-model="activeTab" :disabled-years="disabledYears" />
        </div>
      </div>
    </template>

    <el-empty v-if="!history.pending.value && !hasAnyData" description="這檔股票尚無歷史資料，可能尚未排入資料回填" :image-size="64" />
    <el-empty v-else-if="!visibleMetrics.length" description="請至少選擇一項指標" :image-size="64" />
    <template v-else>
      <p v-if="marginTrendSummary" class="margins-chart__summary">{{ marginTrendSummary }}</p>
      <div class="margins-chart__grid">
        <div v-for="metric in visibleMetrics" :key="metric.key" class="margins-chart__mini">
          <span class="margins-chart__mini-title">{{ metric.label }}歷史走勢</span>
          <SharedChart v-loading="history.pending.value" class="margins-chart__mini-chart" :option="metricOptionsByKey[metric.key]" :init-options="{ renderer: 'svg' }" autoresize />
        </div>
      </div>
      <SharedDataFreshnessNote source-label="公開發行公司財務報表" :as-of="latestPoint?.label ?? null" />
    </template>
  </el-card>
</template>

<style scoped>
.margins-chart {
  border-radius: 12px;
}

.margins-chart__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.margins-chart__title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.margins-chart__header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Widened 2026-09-14 (reported live: "該下拉選單希望寬度多點，她現在把文字截掉了") — the
   `collapse-tags` prop itself turned out to be the real cause, not the width: Element Plus
   collapses to 1 visible tag + "+N" unconditionally once >1 is selected, regardless of how much
   room the select actually has (removed from the template for that reason, see the el-select's
   own usage). 240px still wrapped the default 2-tag selection onto 2 lines (confirmed live via
   screenshot) — 320px is what actually fits the widest 2-tag combination (營業利益率＋稅後淨利率)
   on one line without wrapping. */
.margins-chart__metric-select {
  width: 320px;
}

.margins-chart__info {
  font-size: 0.875rem;
  color: var(--el-text-color-placeholder);
  cursor: help;
}

.margins-chart__summary {
  margin: 4px 8px 8px;
  font-size: 1rem;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.margins-chart__grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.margins-chart__mini-title {
  display: block;
  margin: 0 8px;
  font-size: 1rem;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

.margins-chart__mini-chart {
  height: 8.75rem;
  width: 100%;
}
</style>
