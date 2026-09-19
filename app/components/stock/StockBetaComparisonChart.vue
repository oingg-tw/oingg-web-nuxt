<script setup lang="ts">
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { InfoFilled } from '@element-plus/icons-vue'
import type { LookbackWindow } from '~/utils/lookback-window'
import type { StockBetaWindow } from '~/composables/stock/useStockBeta'
import type { StatItem } from '~/components/shared/SharedStatRow.vue'

use([SVGRenderer, LineChart, GridComponent, LegendComponent, TooltipComponent])

// 30-char strict cap (standing rule, see feedback_info_text_30_char_limit memory).
const INFO_TEXT = '個股與大盤同基期100比較，非本益比'

// Beta's "公司股價 vs 大盤走勢對照" chart, rebuilt 2026-09-14 once bff-ts's
// GET /market/taiex-daily-price proxy went live.
//
// Two price series live on wildly different absolute scales (e.g. a NT$600 stock vs a ~17,000-
// point TAIEX), so both are rebased to 100 at the first shared window date — single Y axis, no
// dual-axis (a dual-axis raw-price overlay lets either axis's scale be tuned to flatter one
// series, a real manipulation vector this app avoids everywhere). Base date is always whatever
// the user's own lookback-window selection resolves to (SharedLookbackWindowSelect, same
// 近1/2/3/5/8年 control every other card here uses), never a hardcoded date.
//
// 2026-09-15: simplified back down after a redesign (summary stats + expand toggle + a second
// mini-toggle for beta stats) grew genuinely overcomplicated — 直接指出"現在反而複雜到離譜，必須
// 簡化 打掉重練". Kept only what earned its place: dash-pattern line differentiation (個股 solid,
// 加權指數 dashed — real accessibility value, doesn't rely on color alone) and neutral wording.
// Chart and beta-coefficient stats are both always visible, no toggles.
const props = defineProps<{
  symbol: string
  name: string
}>()

const symbolRef = computed(() => props.symbol)
// Renamed 2026-09-16 per direct request ("台積電股價 vs 加權指數 改名為 大盤連動程度") — supersedes
// the 2026-09-14 per-company title ("卡片名稱要用該公司名稱 比如 台積電股價 vs 加權指數"); this is
// now a fixed, symbol-agnostic label describing what the chart shows (個股走勢跟大盤的連動程度)
// rather than restating the company name a second time (the summary card above already shows it).
const cardTitle = '大盤連動程度'
const activeTab = ref<LookbackWindow>('近5年')

// 收合狀態 2026-09-16 per直接要求（"大盤連動程度 圖表也要收合"）— 見下方 SharedExpandToggle 自己
// 的 template 註解。
const chartExpanded = ref(false)

const dailyLimit = ref(2000)

const { data: stockDaily, pending: stockPending, earliestAvailableTradeDate } = useDailyPriceHistory(symbolRef, dailyLimit)
const { data: taiexDaily, pending: taiexPending } = useTaiexDailyPrice(dailyLimit)

const pending = computed(() => stockPending.value || taiexPending.value)

// Beta coefficient — analysis-ts only computes 3 fixed windows, each at its own required
// sampling interval (1Y daily, 2Y weekly, 5Y monthly; not a free choice, see betaDefinition.ts),
// which is a narrower set than this card's own 近1/2/3/5/8年 lookback-window control.
//
// Real bug fixed 2026-09-16 (reported live: "大盤連動程度 不應該一口氣看到所有期間的beta 只看到
// 當前用戶選擇的就好了") — this used to render ALL 3 beta windows in their own stat row below the
// chart regardless of which lookback-window the user had picked for the CHART itself, so the same
// card showed one period's price comparison next to a completely unrelated set of 3 different
// periods' beta numbers at once. Now only the single window matching the user's own current
// selection is looked up; 近3年/近8年 have no matching beta window at all (analysis-ts doesn't
// compute those intervals), shown as 資料不足 rather than silently substituting a nearby window's
// number under the selected period's own label.
const LOOKBACK_TO_BETA_TIMEFRAME: Partial<Record<LookbackWindow, StockBetaWindow['timeframe']>> = {
  '近1年': '1Y_1D',
  '近2年': '2Y_1W',
  '近3年': '3Y_1W',
  '近5年': '5Y_1M'
}
const { data: betaData } = useStockBeta(symbolRef)
const selectedBeta = computed(() => {
  const timeframe = LOOKBACK_TO_BETA_TIMEFRAME[activeTab.value]
  if (!timeframe) return null
  return betaData.value?.windows.find(window => window.timeframe === timeframe) ?? null
})

// 文字摘要 — 加回 2026-09-15 per直接要求（"這邊希望加上文字摘要"），沿用同一套 SharedStatRow
// 呈現方式（跟股價與月營收卡片一致）。基期=100，所以最新一期指數值 − 100 就是這段期間的累計
// 變動百分比，不需要另外重算。用詞固定「累計變動」這個中性描述，不用「領先/跑贏/相對強弱」
// （不下趨勢評價，同本檔案標題比較卡的既有原則）。
function cumulativeChangeText(index: number | null): string {
  if (index === null) return '資料不足'
  const change = index - 100
  return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`
}

// Labels shortened 2026-09-16 per direct request ("大盤連動程度 底下的 XXX累計變動 用字要縮短")
// — both changes combined ("以上皆是"): "累計" dropped (變動 alone still reads as the same
// period-over-period change, no ambiguity introduced) AND the company's own short name replaced
// with 個股/大盤 (the card's own title no longer names the company either, since it was renamed
// off "{company}股價 vs 加權指數" to the symbol-agnostic "大盤連動程度" earlier the same day —
// repeating the company name here would be the only remaining spot in this card doing so).
//
// 3rd item (Beta) added 2026-09-16 per direct follow-up ("加上Beta") — the card's own title IS
// "大盤連動程度", so the summary row reads incomplete without the one number that actually
// quantifies that connection. Originally fixed to 1年 regardless of the chart's own lookback-
// window selection; now driven by `selectedBeta` above so it tracks whichever window the user
// actually has the chart set to (see that computed's own comment for why 近3/8年 show 資料不足).
const summaryStats = computed<StatItem[]>(() => [
  { label: '個股變動', value: cumulativeChangeText(latestPoint.value?.stockIndex ?? null) },
  { label: '大盤變動', value: cumulativeChangeText(latestPoint.value?.taiexIndex ?? null) },
  { label: `${activeTab.value} Beta`, value: selectedBeta.value?.value != null ? selectedBeta.value.value.toFixed(2) : '資料不足' }
])

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

// Real follow-up 2026-09-16 ("選項右上角的時間也要幫我變動到有資料的時間，五年是預設值，但是
// 時間長度不夠就改3年2年1年") — a frontend watcher guessing the right default from raw array
// lengths was rejected on the spot ("不該新增一個watcher，請跟analysis提需求"): this used to
// estimate "enough data" with a rough 250-trading-days/year heuristic against whatever daily-
// price-history/taiex-daily-price happened to return. bff-ts shipped `earliestAvailableTradeDate`
// on daily-price-history the same day per that exact ask (see useDailyPriceHistory.ts's own
// comment) — an EXACT date-diff now, same precision StockValuationRiverChart.vue's own
// disabledYears already gets for free from useMetricHistory's `total` field (a real backend-
// reported period count). TAIEX's own history is effectively unlimited (the index has decades of
// data, far beyond any LOOKBACK_YEARS option), so the symbol's own earliest date is always the
// real constraint — no need to also check taiexDaily's own length the old heuristic did.
const yearsOfHistory = computed(() => {
  if (!earliestAvailableTradeDate.value) return null
  const earliest = new Date(earliestAvailableTradeDate.value)
  const msPerYear = 365.25 * 24 * 60 * 60 * 1000
  return (Date.now() - earliest.getTime()) / msPerYear
})
const disabledYears = computed(() =>
  LOOKBACK_YEARS.filter(years => yearsOfHistory.value !== null && yearsOfHistory.value! < years)
)

// Rebase to the first point where BOTH series have a real close — that shared date becomes the
// 100 baseline (co-movement read FROM this point).
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
      return `<div style="font-size: 1rem;min-width:190px;">
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
  // 個股實線／加權指數虛線，兩條線不只靠顏色區分。
  series: [
    {
      name: props.name,
      type: 'line',
      showSymbol: true,
      symbolSize: 8,
      lineStyle: { width: 2.5, color: stockLineColor.value, type: 'solid' },
      itemStyle: { color: stockLineColor.value },
      data: points.value.map(point => point.stockIndex),
      z: 10
    },
    {
      name: '加權指數',
      type: 'line',
      showSymbol: true,
      symbolSize: 8,
      lineStyle: { width: 2.5, color: taiexLineColor.value, type: 'dashed' },
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

    <!-- 圖表收合 2026-09-16 per直接要求（"大盤連動程度 圖表也要收合"）— 跟股價與月營收/本益比／
         本淨比河流圖同一顆 SharedExpandToggle.vue（不是 SharedPercentileGaugeExpand.vue：這張卡片
         沒有百分位/min/max 的概念，只有 SharedStatRow 的摘要數字，跟 StockPriceRevenueChart.vue
         同樣直接用底層的展開/收合骨架）。摘要列固定顯示，圖表本身跟資料來源說明收進展開層。

         This comment sits ABOVE the v-if, never between the v-if and its v-else: in dev builds
         Vue keeps template comments, and a comment wedged between the two branches gets compiled
         into the v-else branch on the client but rendered differently by the SSR compiler —
         a real hydration node/children mismatch on this exact card once company-health SSR'd
         its cards (measured 2026-09-19). -->
    <el-empty v-if="!pending && !hasAnyData" description="這檔股票尚無歷史資料，可能尚未排入資料回填" :image-size="64" />
    <SharedExpandToggle
      v-else
      v-model:expanded="chartExpanded"
      expand-label="展開圖表看走勢"
      collapse-label="收合圖表"
    >
      <SharedStatRow v-if="hasAnyData" :stats="summaryStats" />
      <template #expanded>
        <SharedChart v-loading="pending" class="beta-comparison-chart__chart" :option="option" :init-options="{ renderer: 'svg' }" autoresize />
        <SharedDataFreshnessNote source-label="證交所／櫃買中心每日收盤價、加權股價指數" :as-of="latestPoint?.label ?? null" />
      </template>
    </SharedExpandToggle>
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
  font-size: 0.875rem;
  color: var(--el-text-color-placeholder);
  cursor: help;
}

.beta-comparison-chart__chart {
  height: 16.25rem;
  width: 100%;
}
</style>
