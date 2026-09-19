<script setup lang="ts">
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import type { LookbackWindow } from '~/utils/lookback-window'
import type { StatItem } from '~/components/shared/SharedStatRow.vue'

use([SVGRenderer, BarChart, LineChart, GridComponent, LegendComponent, TooltipComponent])

// Merged from StockPriceHistoryChart.vue (股價歷史, 市場評價) + StockRevenueChart.vue (月營收與
// 年增率, 成長動能) into one card 2026-09-14 per direct request ("股價歷史卡片 希望與呈現月營收
// 合併呈現"). Kept in 市場評價 (where 股價歷史 already lived) — a "how has the market priced this
// stock alongside its actual revenue trend" card reads as valuation context first, growth detail
// second.
//
// Only 2 series now, not 3: 月營收 (bar) + 收盤價 (line). The 年增率 line StockRevenueChart.vue
// used to plot alongside 月營收 is dropped as a THIRD visual series — per the 高齡友善圖表類型
//可用性分級與選型決策框架 the user shared the same day (line charts capped at ≤2 lines; this
// card already spends its one "line" budget on 收盤價, the actual point of merging in a stock-
// price card) — but 年增率/月增率/累計營收年增率 stay fully available in the tooltip's own text
// rows, just not plotted, so no information is actually lost, only de-emphasized relative to the
// new price overlay.
//
// Granularity is forced to MONTHLY (股價歷史's own daily resolution collapses to each month's
// last trading day close) since 月營收 only ever has one data point per month — there is no
// finer shared time axis the two series could both plot on. StockPriceHistoryChart.vue's own
// 1個月/3個月/6個月/1年/5年 window selector is gone with it; this card uses the same 近5年/近10年
// month-count window StockRevenueChart.vue already had, the one granularity both series share.
const props = defineProps<{
  symbol: string
}>()

const symbolRef = computed(() => props.symbol)
const { data: allRevenueEntries, pending: revenuePending } = useMonthlyRevenueHistory(symbolRef)

const activeTab = ref<LookbackWindow>('近5年')
const disabledYears = computed(() =>
  LOOKBACK_YEARS.filter(years => allRevenueEntries.value !== null && allRevenueEntries.value!.length < years * 12)
)

const revenueEntries = computed(() => {
  const all = allRevenueEntries.value ?? []
  const windowSize = LOOKBACK_WINDOW_YEARS[activeTab.value] * 12
  return all.slice(-windowSize)
})

const hasAnyData = computed(() => revenueEntries.value.length > 0)
const latestYearMonth = computed(() => allRevenueEntries.value?.at(-1)?.yearMonth ?? null)

// 摘要列加在圖表上方 — per直接要求（"摘要在上，說的是股價與月營收這一張"），跟旁邊並排的「股價
// vs 加權指數」卡片一樣先給數字再接圖表，維持並排時的版面一致。改用 SharedStatRow.vue 呈現（見
// 那個檔案自己的說明）——per直接要求（"這個所謂摘要，能統一呈現方式嗎？我打算未來讓所有的卡片都
// 比照"）。
const latestRevenueEntry = computed(() => allRevenueEntries.value?.at(-1) ?? null)

function formatPercent(value: number | null): string {
  return value !== null ? `${value > 0 ? '+' : ''}${value.toFixed(2)}%` : '資料不足'
}

// Split 2026-09-16 per direct request ("這張幫我拆開，因為他說了兩件事情。第一個是五年月營收與
// 自己股價的關係。另一個是上次月營收公布後到現在的股價變化") — this card used to also carry a
// 3rd "股價反應" stat (單一公告事件的短期市場反應), a different question/time-scale than the
// multi-年 lookback-window chart this card itself shows. Moved out to its own
// StockRevenuePriceReactionCard.vue (see that file's own comment) — this card now only covers
// 年增/月增 (this period's revenue growth, describing the SAME chart/window the card renders).
const summaryStats = computed<StatItem[]>(() => [
  { label: '年增', value: latestRevenueEntry.value ? formatPercent(latestRevenueEntry.value.yoyChangePercent) : '資料不足' },
  { label: '月增', value: latestRevenueEntry.value ? formatPercent(latestRevenueEntry.value.momChangePercent) : '資料不足' }
])

// 收合狀態 2026-09-15 per直接要求（"這張圖表也要收合，跟河流圖一樣"）— 見下方 SharedExpandToggle
// 自己的 template 註解。
const chartExpanded = ref(false)

// bff-ts caps daily-price-history at 2000 days (~8 real trading years) — see
// useDailyPriceHistory.ts's own comment. Fetched once at that ceiling regardless of the
// 近5年/近10年 toggle above (cheap enough, and simpler than re-fetching a second daily window) —
// a symbol with less real history than the window asks for just shows fewer month-end points,
// same "render however much real data exists" convention every other chart here already follows.
const dailyLimit = ref(2000)
const { data: dailyPrices } = useDailyPriceHistory(symbolRef, dailyLimit)

// One 收盤價 point per revenue month: the LAST trading day on or before that month's end whose
// tradeDate falls within it — daily-price-history's own entries are ascending (oldest→newest,
// same order confirmed for every other PIT endpoint in this app), so the last matching entry in
// array order is the month's own last trading day.
function monthEndClose(yearMonth: string): number | null {
  const daily = dailyPrices.value
  if (!daily) return null
  for (let i = daily.length - 1; i >= 0; i--) {
    if (daily[i]!.tradeDate.startsWith(yearMonth)) return daily[i]!.close
  }
  return null
}

// Amount fields arrive as bigint-serialized strings in NT$ thousand (see
// useMonthlyRevenueHistory.ts's own comment) — 1億元 = 100,000 千元.
function toYi(raw: string): number {
  return Number(raw) / 100_000
}

const { resolvedMode, market, color: accentColor } = useAppTheme()
const priceColors = computed(() => getPriceColors(resolvedMode.value, market.value))
const lineColor = computed(() => getAccentColor(resolvedMode.value, accentColor.value))
const chartInk = computed(() => getChartInk(resolvedMode.value))

function periodLabel(entry: { yearMonth: string }): string {
  return entry.yearMonth
}

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
    axisPointer: { type: 'shadow' },
    appendTo: 'body',
    backgroundColor: CHART_TOOLTIP.backgroundColor,
    borderColor: CHART_TOOLTIP.borderColor,
    textStyle: { color: CHART_TOOLTIP_INK.primary },
    formatter: (params: AxisTooltipParam | AxisTooltipParam[]) => {
      const list = Array.isArray(params) ? params : [params]
      const dataIndex = list[0]?.dataIndex ?? 0
      const entry = revenueEntries.value[dataIndex]
      if (!entry) return ''
      const rowStyle = 'display:flex;justify-content:space-between;gap:16px;padding:2px 0;'
      const row = (label: string, value: string) =>
        `<div style="${rowStyle}"><span>${label}</span><strong>${value}</strong></div>`
      const pct = (value: number | null) => (value !== null ? `${value > 0 ? '+' : ''}${value.toFixed(2)}%` : '資料不足')
      const close = monthEndClose(entry.yearMonth)
      const closeRow = close !== null ? row('當月最後收盤價', `${close.toFixed(2)} 元`) : ''
      const noteRow = entry.note !== null
        ? `<div style="${rowStyle}color:${CHART_TOOLTIP_INK.secondary};"><span>公司說明</span><strong>${entry.note}</strong></div>`
        : ''
      return `<div style="font-size: 1rem;min-width:170px;">
        <div style="font-weight:600;margin-bottom:4px;">${periodLabel(entry)}</div>
        ${row('月營收', `${toYi(entry.currentMonthRevenue).toFixed(1)} 億元`)}
        ${closeRow}
        ${row('年增率', pct(entry.yoyChangePercent))}
        ${row('月增率', pct(entry.momChangePercent))}
        ${row('累計營收年增率', pct(entry.cumulativeChangePercent))}
        ${noteRow}
      </div>`
    }
  },
  xAxis: {
    type: 'category',
    data: revenueEntries.value.map(periodLabel),
    axisLine: { lineStyle: { color: chartInk.value.baseline } },
    axisTick: { show: false },
    axisLabel: { color: chartInk.value.muted, fontSize: 16 }
  },
  yAxis: [
    {
      type: 'value',
      name: '億元',
      nameTextStyle: { color: chartInk.value.muted, fontSize: 16 },
      scale: true,
      splitLine: { lineStyle: { color: chartInk.value.gridline, type: 'solid' } },
      axisLabel: { color: chartInk.value.muted, fontSize: 16 }
    },
    {
      type: 'value',
      name: '元',
      nameTextStyle: { color: chartInk.value.muted, fontSize: 16 },
      scale: true,
      splitLine: { show: false },
      axisLabel: { color: chartInk.value.muted, fontSize: 16 }
    }
  ],
  series: [
    {
      name: '月營收',
      type: 'bar',
      yAxisIndex: 0,
      barMaxWidth: 24,
      data: revenueEntries.value.map(entry => ({
        value: toYi(entry.currentMonthRevenue),
        itemStyle: {
          color: entry.yoyChangePercent < 0 ? priceColors.value.down : priceColors.value.up,
          borderRadius: [4, 4, 0, 0]
        }
      }))
    },
    // 高齡友善框架要求折線圖轉折點要有大型實心標記（showSymbol 不可為 false）、線條加粗至
    // 2.5px 以上 — 這條線本身也是整張卡片唯一的一條折線（跟月營收長條分開算），符合「最多2條線」
    // 的上限（其實只用了 1 條）。
    {
      name: '收盤價',
      type: 'line',
      yAxisIndex: 1,
      showSymbol: true,
      symbolSize: 6,
      smooth: true,
      smoothMonotone: 'x',
      lineStyle: { width: 2.5, color: lineColor.value },
      itemStyle: { color: lineColor.value },
      data: revenueEntries.value.map(entry => monthEndClose(entry.yearMonth)),
      z: 10
    }
  ]
}))
</script>

<template>
  <el-card class="price-revenue-chart" shadow="never" :body-style="{ padding: '4px 4px 8px' }">
    <template #header>
      <div class="price-revenue-chart__header">
        <StockCardTitle title="股價與月營收" info-text="月營收（長條）與當月最後收盤價（折線）" />
      </div>
    </template>

    <!-- 圖表收合 2026-09-15 per直接要求（"這張圖表也要收合，跟河流圖一樣"）— 跟本益比/本淨比
         河流圖用同一顆 SharedExpandToggle.vue（不是 SharedPercentileGaugeExpand.vue：那個元件
         本身會畫一條量尺長條，這張卡片沒有百分位/min/max 的概念，只有 SharedStatRow 的摘要數字，
         直接用底層的展開/收合骨架就好）。摘要列固定顯示，圖表本身跟資料來源說明收進展開層。
         SharedLookbackWindowSelect 移進展開層 2026-09-16 per直接要求（"股價與月營收那張的下拉要
         放在收合裡面"）— 收合時看不到、也不能調整期間選擇，避免摘要列數字（固定用 activeTab 決定
         的期間）跟一個看不見的控制項脫鉤。

         Kept ABOVE the v-if on purpose (see StockBetaComparisonChart.vue's own note): a comment
         between v-if and v-else is a dev-mode hydration mismatch now that this card is SSR'd. -->
    <el-empty v-if="!revenuePending && !hasAnyData" description="這檔股票尚無歷史資料，可能尚未排入資料回填" :image-size="64" />
    <SharedExpandToggle
      v-else
      v-model:expanded="chartExpanded"
      expand-label="展開圖表看走勢"
      collapse-label="收合圖表"
    >
      <SharedStatRow :stats="summaryStats" />
      <template #expanded>
        <SharedLookbackWindowSelect v-model="activeTab" :disabled-years="disabledYears" />
        <SharedChart v-loading="revenuePending" class="price-revenue-chart__chart" :option="option" :init-options="{ renderer: 'svg' }" autoresize />
        <SharedDataFreshnessNote source-label="公開發行公司月營收公告／證交所每日收盤價" :as-of="latestYearMonth" />
      </template>
    </SharedExpandToggle>
  </el-card>
</template>

<style scoped>
.price-revenue-chart {
  border-radius: 12px;
}

.price-revenue-chart__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.price-revenue-chart__chart {
  height: 16.25rem;
  width: 100%;
}
</style>
