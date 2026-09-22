<script setup lang="ts">
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, MarkAreaComponent } from 'echarts/components'
import type { MarketEventsPageData } from '#shared/types/hub'
import { BEAR_THRESHOLD_PCT, PHASE_CONTEXT, findMarketPhases, type MarketPhase } from '#shared/utils/market-phases'
import { MARKET_EVENTS_SORTED } from '#shared/utils/market-events'
import { clampDescription } from '~/utils/stock-digest'
import { getAccentColor, getChartInk, CHART_TOOLTIP, CHART_TOOLTIP_INK } from '~/utils/chart-palette'

// /macro/market-phases — 市場階段（2026-09-22）. The counterpart of /macro/market-events, and the
// answer to「1990年台股崩盤事件簿，不能放進來嗎?」— it cannot go on the events page, because it has no
// declaration date, and it CAN go here, because it is a 75.7% decline the series itself reports.
//
// The two pages are deliberately separate rather than two layers on one chart（「分開sidebar功能」）:
// a declaration is a fact about the world and a drawdown is a fact about the series, and keeping
// them on different pages is what keeps either from reading as the cause of the other. See
// shared/utils/market-phases.ts for the rule, the algorithm, and what this series cannot catch.
//
// NOTHING HERE IS NAMED. The table says which months and how far; the reader who remembers the
// period names it. Writing 泡沫 or 股災 beside a number would turn a measurement into a judgement.
//
// Same index series and same data call as the events page — one cached fetch serves both.
use([SVGRenderer, LineChart, GridComponent, TooltipComponent, MarkAreaComponent])

const { data, error } = await useFetch<MarketEventsPageData>('/api/hub/macro-market-events', { key: 'hub-macro-market-events' })
if (error.value || !data.value) throw createError({ statusCode: 503, statusMessage: '大盤指數資料暫時無法取得', fatal: true })

const { resolvedMode, color: accentColorName } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))

const months = computed(() => (data.value?.months ?? []).map(month => ({ period: month.period, value: month.avgTaiex })))
const labels = computed(() => months.value.map(month => month.period))
const firstMonth = computed(() => labels.value[0] ?? '')
const lastMonth = computed(() => labels.value[labels.value.length - 1] ?? '')

// Computed over the WHOLE series, never over a window: a phase's peak or recovery can sit outside
// any lookback, and cutting the series first would invent phases at the cut. This page therefore
// has no lookback selector — the events page's one exists to zoom a marker timeline, and a phase
// table is already the zoom.
const phases = computed(() => findMarketPhases(months.value))

// Declared events whose month falls inside a phase — a date-range join, nothing more. Measured before
// this was built: 11 phases, 5 with at least one event inside, 6 with none（the deepest, 1990, among
// them）. That emptiness is the evidence the join is honest; a list built to explain the falls would
// have no blanks.
const eventsWithin = (phase: MarketPhase) =>
  MARKET_EVENTS_SORTED.filter(event => {
    const month = event.date.slice(0, 7)
    return month >= phase.peakPeriod && month <= phase.troughPeriod
  })

const contextFor = (phase: MarketPhase) => PHASE_CONTEXT[phase.peakPeriod] ?? null

const indexText = (value: number | null): string =>
  value === null ? '尚無資料' : value.toLocaleString('zh-TW', { maximumFractionDigits: 0 })
// Absolute: every place this prints sits beside 跌 or under a 跌幅 header, so the sign is already
// said in words and「跌了 −75.7%」would say it twice.
const pctText = (value: number): string => `${Math.abs(value).toFixed(1)}%`

// Months from peak to trough — how long the fall took.
const monthsBetween = (from: string, to: string): number => {
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  return (ty! - fy!) * 12 + (tm! - fm!)
}

const formatAxisIndex = (value: number): string => value.toLocaleString('zh-TW', { maximumFractionDigits: 0 })

const indexExtent = computed(() => {
  const values = months.value.map(month => month.value).filter(value => value > 0)
  if (!values.length) return null
  return { min: Math.floor(Math.min(...values) * 0.9), max: Math.ceil(Math.max(...values) * 1.1) }
})

interface AxisTooltipParam { dataIndex?: number }

const chartOption = computed(() => {
  const list = months.value
  const accent = getAccentColor(resolvedMode.value, accentColorName.value)
  const extent = indexExtent.value
  const monthLabels = labels.value
  return {
    textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
    grid: { left: 8, right: 16, top: 40, bottom: 28, containLabel: true },
    tooltip: {
      trigger: 'axis',
      appendTo: 'body',
      backgroundColor: CHART_TOOLTIP.backgroundColor,
      borderColor: CHART_TOOLTIP.borderColor,
      textStyle: { color: CHART_TOOLTIP_INK.primary },
      formatter: (params: AxisTooltipParam | AxisTooltipParam[]) => {
        const index = (Array.isArray(params) ? params[0] : params)?.dataIndex ?? 0
        const month = list[index]
        if (!month) return ''
        const inside = phases.value.find(phase => month.period >= phase.peakPeriod && month.period <= phase.troughPeriod)
        return `<div style="font-size:1rem"><div style="font-weight:600;margin-bottom:4px">${month.period}</div>`
          + `<div>加權指數月平均 ${indexText(month.value)}</div>`
          + (inside ? `<div style="color:${CHART_TOOLTIP_INK.secondary}">下跌段 ${inside.peakPeriod} → ${inside.troughPeriod}（${pctText(inside.declinePct)}）</div>` : '')
          + '</div>'
      }
    },
    xAxis: {
      type: 'category',
      data: monthLabels,
      axisLine: { lineStyle: { color: chartInk.value.baseline } },
      axisTick: { show: false },
      axisLabel: { color: chartInk.value.muted, fontSize: 16 }
    },
    yAxis: {
      type: 'log',
      logBase: 10,
      name: '指數',
      nameTextStyle: { color: chartInk.value.muted, fontSize: 16 },
      ...(extent ? { min: extent.min, max: extent.max } : {}),
      splitLine: { lineStyle: { color: chartInk.value.gridline } },
      axisLabel: { color: chartInk.value.muted, fontSize: 16, formatter: formatAxisIndex }
    },
    series: [
      {
        name: '加權股價指數（月平均）',
        type: 'line',
        showSymbol: false,
        smooth: false,
        lineStyle: { width: 2, color: accent },
        itemStyle: { color: accent },
        data: list.map(month => month.value),
        // Each phase is a shaded band from its peak month to its trough month. Bands, not lines:
        // a phase is a span, and shading is what says「這一整段」without a label.
        markArea: {
          silent: true,
          itemStyle: { color: chartInk.value.primary, opacity: 0.12 },
          data: phases.value.map(phase => [
            { xAxis: monthLabels.indexOf(phase.peakPeriod) },
            { xAxis: monthLabels.indexOf(phase.troughPeriod) }
          ])
        }
      }
    ]
  }
})

const overviewAnswer = computed(() => {
  if (!months.value.length) return null
  return `加權股價指數的月平均共 ${months.value.length} 期，涵蓋 ${firstMonth.value} 至 ${lastMonth.value}；其中從高點回落超過 ${BEAR_THRESHOLD_PCT}% 的下跌段共 ${phases.value.length} 段，圖上以陰影標出。`
})

const listAnswer = computed(() => {
  const biggest = phases.value.reduce<MarketPhase | null>((acc, phase) => (!acc || phase.declinePct < acc.declinePct ? phase : acc), null)
  if (!biggest) return null
  const recovery = biggest.recoveryPeriod ? `，直到 ${biggest.recoveryPeriod} 才回到當時的高點` : '，至今尚未回到當時的高點'
  return `跌幅最深的一段是 ${biggest.peakPeriod} 到 ${biggest.troughPeriod}，從 ${indexText(biggest.peakValue)} 回落到 ${indexText(biggest.troughValue)}，跌了 ${pctText(biggest.declinePct)}${recovery}。`
})

const DESCRIPTION = '從加權股價指數 1987 年以來的月平均序列，找出每一段從高點回落超過 20% 的下跌區間，列出高點、低點、跌幅與回到前高的時間，不對原因做任何推論。'

const { breadcrumbs } = useHubPageSeo({
  title: '台股大盤歷次下跌段：1987 年以來回落超過 20% 的區間',
  description: DESCRIPTION,
  path: '/macro/market-phases',
  breadcrumbs: [
    { label: '首頁', to: '/' },
    { label: '總經特區', to: '/macro' },
    { label: '市場階段', to: '/macro/market-phases' }
  ]
})

useSeoMeta({ description: computed(() => clampDescription(DESCRIPTION)) })
</script>

<template>
  <div class="macro-phases-page">
    <h1 class="macro-phases-page__title">台股大盤歷次下跌段</h1>
    <StockBreadcrumb :items="breadcrumbs" />
    <MacroNav />

    <StockQuestionSection id="macro-phases-chart" question="大盤有過哪幾段明顯的下跌？" :answer="overviewAnswer">
      <el-card shadow="never" class="macro-phases-page__card">
        <SharedChart
          v-if="months.length > 1"
          class="macro-phases-page__chart"
          :option="chartOption"
          :init-options="{ renderer: 'svg' }"
          autoresize
        />
        <p class="macro-phases-page__caveat">
          陰影是從高點到低點的下跌段。縱軸為對數刻度，這樣 1980 年代的一千多點和近年的四萬多點才能在同一張圖上看清楚。
        </p>
      </el-card>
    </StockQuestionSection>

    <StockQuestionSection id="macro-phases-list" question="每一段跌了多深、跌了多久？" :answer="listAnswer">
      <!-- The summary table stays as the one data table（sortable at a glance, one row per phase）;
           what each phase was living through follows it as a list, one item per phase, because
           several dated lines per row would not survive as a table cell at phone width. -->
      <SharedTableScroll label="加權指數歷次回落超過 20% 的下跌段">
        <table class="seo-table" data-ssr-table>
          <caption>加權股價指數月平均從高點回落超過 {{ BEAR_THRESHOLD_PCT }}% 的每一段，由舊到新</caption>
          <thead>
            <tr>
              <th scope="col">高點</th>
              <th scope="col">低點</th>
              <th scope="col">跌幅</th>
              <th scope="col">下跌歷時</th>
              <th scope="col">回到前高</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="phase in phases" :key="phase.peakPeriod">
              <!-- The whole cell is the link, not just the month: an inline element boundary
                   mid-cell trips the SSR-vs-live table comparison（tag stripping inserts a space
                   there, innerText does not）, and a link reading「1987-10（3,590）」is the better
                   link text anyway. -->
              <th scope="row"><a :href="`#phase-${phase.peakPeriod}`">{{ phase.peakPeriod }}（{{ indexText(phase.peakValue) }}）</a></th>
              <td>{{ phase.troughPeriod }}（{{ indexText(phase.troughValue) }}）<template v-if="phase.open">，仍在下跌</template></td>
              <td>{{ pctText(phase.declinePct) }}</td>
              <td>{{ monthsBetween(phase.peakPeriod, phase.troughPeriod) }} 個月</td>
              <td>{{ phase.recoveryPeriod ?? '尚未' }}</td>
            </tr>
          </tbody>
        </table>
      </SharedTableScroll>
    </StockQuestionSection>

    <!-- 當時發生了什麼（2026-09-22,「只看階段對用戶沒意義」→「每一段都請上網找…蒐集起來呈現」）.
         The heading is deliberately「發生了什麼」and not「為什麼跌」: each item lists dated facts from
         the period and the declared events that fell inside it, and never joins them to the decline
         with a causal verb. Every fact was checked against the Wikipedia article named beside it. -->
    <StockQuestionSection id="macro-phases-context" question="每一段下跌的期間，當時發生了什麼？">
      <p class="hub-answer">
        以下按時間順序列出每一段下跌期間內、有明確日期的公開事件，以及本站「大事件與大盤」頁收錄的宣告事件中落在該段的項目。
        這裡只記錄「同一段時間內發生了什麼」，不對事件與指數漲跌之間的關係做任何推論。
      </p>
      <ol class="macro-phases-page__context-list">
        <li v-for="phase in phases" :id="`phase-${phase.peakPeriod}`" :key="phase.peakPeriod" class="macro-phases-page__context-item">
          <h3 class="macro-phases-page__context-title">
            {{ phase.peakPeriod }} → {{ phase.troughPeriod }}，跌 {{ pctText(phase.declinePct) }}
          </h3>
          <template v-if="contextFor(phase)">
            <ul class="macro-phases-page__facts">
              <li v-for="fact in contextFor(phase)!.facts" :key="fact">{{ fact }}</li>
            </ul>
            <p class="macro-phases-page__sources">查證來源：維基百科「{{ contextFor(phase)!.sources.join('」「') }}」</p>
          </template>
          <p v-else class="macro-phases-page__sources">（尚未整理）</p>
          <p v-if="eventsWithin(phase).length" class="macro-phases-page__events">
            本站宣告事件頁收錄、落在這段期間的：
            <template v-for="(event, index) in eventsWithin(phase)" :key="event.date"><template v-if="index">、</template>{{ event.date }} {{ event.label }}</template>
            （見<NuxtLink to="/macro/market-events">大事件與大盤</NuxtLink>）
          </p>
        </li>
      </ol>
    </StockQuestionSection>

    <StockQuestionSection id="macro-phases-method" question="這一頁怎麼決定哪些算下跌段？">
      <el-card shadow="never" class="macro-phases-page__card">
        <p class="macro-phases-page__line">
          <strong>不是人挑的，是算出來的。</strong>
          指數從某個高點回落超過 {{ BEAR_THRESHOLD_PCT }}%，就算一段；之後從低點反彈超過 {{ BEAR_THRESHOLD_PCT }}%，這一段就結束。{{ BEAR_THRESHOLD_PCT }}% 是財經教科書對「空頭市場」的通用定義，不是本頁自訂的門檻。每一段符合條件的都會出現，不符合的都不會，這一頁沒有選擇權。
        </p>
        <p class="macro-phases-page__line">
          <strong>每一段只有日期和數字，沒有名字。</strong>
          表格不會寫「泡沫」或「股災」，因為那是對一段時期的評價，而數字本身就是那段時期。你若記得那幾年發生了什麼，自然會對上。
        </p>
        <p class="macro-phases-page__line">
          <strong>這裡用的是月平均，抓得到「跌得久」，抓不到「跌得快」。</strong>
          一個月內就急跌急彈的走勢會被平均削掉一半。2020 年 3 月是最清楚的例子：日收盤從 12,180 跌到 8,681，跌了 28.7%，但月平均只從 11,962 跌到 10,138，跌了 15.2%，達不到門檻，所以不在表裡。這不是遺漏，是這個序列的性質。那類事件請看<NuxtLink to="/macro/market-events">大事件與大盤</NuxtLink>，它以宣告日期為準，跟這一頁互補。
        </p>
        <p class="macro-phases-page__line">
          <strong>跟大事件那一頁的分別：</strong>那一頁收錄「世界上發生了什麼」，以有正式宣告日期為準；這一頁列出「指數本身做了什麼」，以跌幅為準。兩頁都不對「什麼造成了什麼」做推論。
        </p>
        <p class="macro-phases-page__line">資料來源：中央銀行金融統計月報（加權股價指數月平均，原始指數由臺灣證券交易所編製）。</p>
      </el-card>
    </StockQuestionSection>
  </div>
</template>

<style scoped>
.macro-phases-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.macro-phases-page__title {
  margin: 0;
  font-size: 1.5rem;
}

.macro-phases-page__card {
  border-radius: 12px;
}

.macro-phases-page__chart {
  width: 100%;
  height: 420px;
}

.macro-phases-page__line {
  margin: 0 0 12px;
  font-size: 1rem;
  line-height: 1.7;
}

.macro-phases-page__line:last-child {
  margin-bottom: 0;
}

.macro-phases-page__context-list {
  margin: 0;
  padding-left: 1.5em;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.macro-phases-page__context-title {
  margin: 0 0 6px;
  font-size: 1.125rem;
  font-weight: 700;
}

.macro-phases-page__facts {
  margin: 0;
  padding-left: 1.25em;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 1rem;
  line-height: 1.7;
}

.macro-phases-page__sources,
.macro-phases-page__events {
  margin: 8px 0 0;
  font-size: 1rem;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.macro-phases-page__caveat {
  margin: 12px 0 0;
  font-size: 1rem;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}
</style>
