<script setup lang="ts">
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, MarkLineComponent } from 'echarts/components'
import type { MarketEventsPageData } from '#shared/types/hub'
import { MARKET_EVENTS_SORTED } from '#shared/utils/market-events'
import { clampDescription } from '~/utils/stock-digest'
import { getAccentColor, getChartInk, CHART_TOOLTIP, CHART_TOOLTIP_INK } from '~/utils/chart-palette'

// /macro/market-events — 大事件與大盤（2026-09-22,「把台股與世界的大事件與台股指數比較。比如
// covid19。」）. 總經特區's eighth page, and the second after policy-rate that draws discrete events
// rather than a continuous series, so it keeps its own route file rather than joining MACRO_PAGES.
//
// THE RISK THIS PAGE CARRIES, and what is done about it. Every other page in the zone reads an
// external series whole — gov-ts publishes every rate decision, the NDC every monthly signal — so
// nothing here decides which rows appear. This is the first page where WE choose, and choosing is
// where a causal impression gets manufactured: mark the events that sit above big drops and the
// chart argues「疫情害股市跌」without one causal sentence being written.
//
// Two things hold that line, both stated on the page itself rather than only here:
//
//   * The inclusion rule is EXTERNAL — an event qualifies on having an official, publicly
//     verifiable declaration date, never on how far the index moved. shared/utils/market-events.ts
//     carries the rule and a source for every row.
//   * NO event-relative statistics. No跌幅, no「幾個月回到原點」, no post-event return. Those encode
//     the causal assumption in their construction: a「事件後 12 個月最低」column asserts the event
//     caused the low, and no disclaimer underneath undoes that. The page puts dated facts and a
//     price line on one time axis and stops, exactly the line /macro/policy-rate already holds.
//
// Monthly, log axis — the same two choices policy-rate made and for the same reasons: the daily
// series caps at 2000 rows（2018-07 onwards）which would drop ten of the thirteen events off the
// left edge, and a linear axis on a 27-year index squashes 1999–2010 into a flat line where most
// of these events live（「大盤股價要用LOG 不然早期的數據會被擠成一條線」）.
//
// An unregistered ECharts component throws NOTHING and silently draws nothing — MarkLineComponent
// is what puts the event lines on the chart and is registered here for that reason.
use([SVGRenderer, LineChart, GridComponent, TooltipComponent, MarkLineComponent])

const { data, error } = await useFetch<MarketEventsPageData>('/api/hub/macro-market-events', { key: 'hub-macro-market-events' })
if (error.value || !data.value) throw createError({ statusCode: 503, statusMessage: '大盤指數資料暫時無法取得', fatal: true })

const { resolvedMode, color: accentColorName } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))

// 回看區間（2026-09-22,「圖表右上角要可以顯示年分，5 8 13 21 35」）— the same Fibonacci scale the
// stock-detail cards use（近1/2/3/5/8年, app/utils/lookback-window.ts）, continued upward because
// this chart spans 27 years rather than 8. That standing「every lookback dropdown uses the same 5
// options」rule was written for cards whose data tops out around a decade; the options here start
// where those end.
//
// 35年 was asked for and is NOT offered, because the index series does not reach that far: monthly
// data starts 1999-01, which is 27.7 years. Offering a window the data cannot fill would print the
// same chart under two different labels — the same reason 近10年 stays disabled on a stock card
// until the symbol has a genuine ten years behind it. 全部 takes that slot and shows everything
// there is; the sentence above the table states how long that actually is.
const MACRO_LOOKBACK = [
  { label: '近5年', years: 5 },
  { label: '近8年', years: 8 },
  { label: '近13年', years: 13 },
  { label: '近21年', years: 21 },
  { label: '全部', years: null }
] as const

// 全部 by default: this page's premise is the long view — 921 and the dot-com years are most of
// why it exists, and they are outside every other window.
const lookback = ref<string>('全部')

const allPoints = computed(() => data.value?.taiex ?? [])

const points = computed(() => {
  const list = allPoints.value
  const years = MACRO_LOOKBACK.find(option => option.label === lookback.value)?.years ?? null
  if (years === null || !list.length) return list
  // Cut by DATE rather than by row count: the monthly series is one row per month with no gaps,
  // but deriving the cutoff from the last row's own date keeps that an observation about the data
  // instead of an assumption about it.
  const last = list[list.length - 1]!.tradeDate
  const cutoff = `${Number(last.slice(0, 4)) - years}${last.slice(4)}`
  return list.filter(point => point.tradeDate >= cutoff)
})

const labels = computed(() => points.value.map(point => point.tradeDate.slice(0, 7)))

// Only events that fall inside the index series' own window get drawn — an earlier declaration
// would be a marker hanging over no line. The 1997 Asian financial crisis and the 1996 Taiwan
// Strait crisis are excluded by this rather than by editorial judgement.
const firstMonth = computed(() => labels.value[0] ?? '')
const lastMonth = computed(() => labels.value[labels.value.length - 1] ?? '')
const events = computed(() =>
  MARKET_EVENTS_SORTED.filter(event => {
    const month = event.date.slice(0, 7)
    return month >= firstMonth.value && month <= lastMonth.value
  })
)

// The index close for the month an event was declared — a fact about that month, printed beside the
// event because it is what「比較」means here. NOT a change, not a drawdown: see the top comment.
const monthClose = (date: string): number | null => {
  const month = date.slice(0, 7)
  const index = labels.value.indexOf(month)
  return index === -1 ? null : (points.value[index]?.close ?? null)
}

const indexText = (value: number | null): string =>
  value === null ? '尚無資料' : value.toLocaleString('zh-TW', { maximumFractionDigits: 0 })

const formatAxisIndex = (value: number): string => value.toLocaleString('zh-TW', { maximumFractionDigits: 0 })

// A log axis left unpinned rounds its bounds out to the next power of ten, which on a 5,000–28,000
// series means an axis running 1,000 to 100,000 and the whole line squashed into its middle third.
const indexExtent = computed(() => {
  const closes = points.value.map(point => point.close).filter(close => close > 0)
  if (!closes.length) return null
  return { min: Math.floor(Math.min(...closes) * 0.9), max: Math.ceil(Math.max(...closes) * 1.1) }
})

interface AxisTooltipParam { dataIndex?: number }

const chartOption = computed(() => {
  const list = points.value
  const accent = getAccentColor(resolvedMode.value, accentColorName.value)
  const extent = indexExtent.value
  const monthLabels = labels.value
  return {
    textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
    grid: { left: 8, right: 16, top: 56, bottom: 28, containLabel: true },
    tooltip: {
      trigger: 'axis',
      appendTo: 'body',
      backgroundColor: CHART_TOOLTIP.backgroundColor,
      borderColor: CHART_TOOLTIP.borderColor,
      textStyle: { color: CHART_TOOLTIP_INK.primary },
      formatter: (params: AxisTooltipParam | AxisTooltipParam[]) => {
        const index = (Array.isArray(params) ? params[0] : params)?.dataIndex ?? 0
        const point = list[index]
        if (!point) return ''
        const sameMonth = events.value.filter(event => event.date.slice(0, 7) === point.tradeDate.slice(0, 7))
        return `<div style="font-size:1rem"><div style="font-weight:600;margin-bottom:4px">${point.tradeDate}</div>`
          + `<div>加權指數 ${indexText(point.close)}</div>`
          + sameMonth.map(event => `<div style="color:${CHART_TOOLTIP_INK.secondary}">${event.date} ${event.label}</div>`).join('')
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
        name: '加權股價指數（月收盤）',
        type: 'line',
        showSymbol: false,
        smooth: false,
        lineStyle: { width: 2, color: accent },
        itemStyle: { color: accent },
        data: list.map(point => point.close),
        // Vertical rules at each declaration month. No label on the line itself — thirteen of them
        // overlapping would be unreadable, and the numbered table below is where a reader reads
        // which is which. The number is the tie between the two.
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: chartInk.value.primary, type: 'dashed', width: 1 },
          label: {
            formatter: (params: { name?: string }) => params.name ?? '',
            color: chartInk.value.muted,
            fontSize: 14
          },
          // Numbers alternate between the top and bottom edges. Several of these declarations are
          // weeks apart and land in adjacent months at this resolution — COVID's PHEIC and pandemic
          // declarations（2020-01, 2020-03）, the Ukraine invasion against the Fed's first hike
          //（2022-02, 2022-03）— and on one row their numbers overlap into a smudge. Two rows means
          // neighbours can never collide, since adjacency always alternates.
          //
          // Two rows rather than three staggered heights: a `distance` offset was tried first and
          // threw labels into the middle of the plot area, which reads as if the number marks a
          // point on the line rather than the whole vertical rule. Both versions were looked at as
          // rendered images, not reasoned about.
          data: events.value.map((event, index) => ({
            xAxis: monthLabels.indexOf(event.date.slice(0, 7)),
            name: String(index + 1),
            label: { position: index % 2 === 0 ? 'insideEndTop' : 'insideStartTop' }
          }))
        }
      }
    ]
  }
})

const coverageAnswer = computed(() => {
  if (!points.value.length) return null
  return `加權股價指數的月收盤共 ${points.value.length} 期，涵蓋 ${firstMonth.value} 至 ${lastMonth.value}；這段期間內符合收錄條件的事件有 ${events.value.length} 件。`
})

const listAnswer = computed(() =>
  '以下每一件都有官方或國際機構正式宣告的日期，並附上該宣告的出處。收錄與否只看有沒有可查證的宣告日期，不看指數當時漲跌多少。'
)

const { breadcrumbs } = useHubPageSeo({
  title: '台股大盤與重大事件年表：1999 年以來的加權股價指數',
  description: '921 地震、SARS、雷曼兄弟、COVID-19、俄烏戰爭等有正式宣告日期的重大事件，標記在加權股價指數 1999 年以來的月收盤走勢上，附逐件日期與出處。',
  path: '/macro/market-events',
  breadcrumbs: [
    { label: '首頁', to: '/' },
    { label: '總經特區', to: '/macro' },
    { label: '大事件與大盤', to: '/macro/market-events' }
  ]
})

useSeoMeta({ description: computed(() => clampDescription('921 地震、SARS、雷曼兄弟、COVID-19、俄烏戰爭等有正式宣告日期的重大事件，標記在加權股價指數 1999 年以來的月收盤走勢上，附逐件日期與出處。')) })
</script>

<template>
  <div class="macro-events-page">
    <h1 class="macro-events-page__title">台股大盤與重大事件年表</h1>
    <StockBreadcrumb :items="breadcrumbs" />
    <MacroNav />

    <StockQuestionSection id="macro-events-chart" question="重大事件發生時，大盤在什麼位置？" :answer="coverageAnswer">
      <el-card shadow="never" class="macro-events-page__card macro-events-page__chart-card">
        <div class="macro-events-page__corner">
          <el-radio-group v-model="lookback" aria-label="圖表顯示區間">
            <el-radio-button v-for="option in MACRO_LOOKBACK" :key="option.label" :value="option.label">{{ option.label }}</el-radio-button>
          </el-radio-group>
        </div>
        <!-- SharedChart declares only `option`; everything else falls through as attrs, so the
             height must come from CSS and not from a `height` prop — passing one renders a
             zero-height container that draws nothing and throws nothing（measured: the container
             came back 1103x0 with no page error at all）. Same four-part call shape the other two
             chart pages in this zone use: class for the height, svg renderer, autoresize, and a
             guard so an empty series never mounts a blank canvas. -->
        <SharedChart
          v-if="points.length > 1"
          class="macro-events-page__chart"
          :option="chartOption"
          :init-options="{ renderer: 'svg' }"
          autoresize
        />
        <p class="macro-events-page__caveat">
          圖上的虛線是事件的宣告日期所在月份，編號對應下方表格。縱軸為對數刻度，這樣 1999 年的數千點和近年的兩萬多點才能在同一張圖上看清楚。
        </p>
      </el-card>
    </StockQuestionSection>

    <StockQuestionSection id="macro-events-list" question="這裡收錄了哪些事件？" :answer="listAnswer">
      <SharedTableScroll label="重大事件與宣告當月的加權指數">
        <table class="seo-table" data-ssr-table>
          <caption>有正式宣告日期的重大事件，與宣告當月的加權股價指數月收盤</caption>
          <thead>
            <tr>
              <th scope="col">編號</th>
              <th scope="col">宣告日期</th>
              <th scope="col">事件</th>
              <th scope="col">當月加權指數</th>
              <th scope="col">宣告出處</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(event, index) in events" :key="event.date + event.label">
              <th scope="row">{{ index + 1 }}</th>
              <td>{{ event.date }}</td>
              <td>{{ event.label }}</td>
              <td>{{ indexText(monthClose(event.date)) }}</td>
              <td>{{ event.source }}</td>
            </tr>
          </tbody>
        </table>
      </SharedTableScroll>
    </StockQuestionSection>

    <StockQuestionSection id="macro-events-method" question="這一頁怎麼決定收錄哪些事件？">
      <el-card shadow="never" class="macro-events-page__card">
        <p class="macro-events-page__line">
          收錄條件只有一條：<strong>事件必須有官方或國際機構正式宣告、而且可以公開查證的日期。</strong>
          例如世界衛生組織的宣告、法院的破產聲請文件、政府的公告。表格最後一欄就是那份宣告。
        </p>
        <p class="macro-events-page__line">
          <strong>不以指數跌幅大小決定收錄與否。</strong>
          如果照「跌得深不深」來挑事件，這張圖就會變成在主張某件事造成了某個跌幅，而那是這個網站不做的推論。
        </p>
        <p class="macro-events-page__line">
          基於同樣的理由，這一頁也<strong>不計算事件之後的漲跌幅、不計算多久回到原來的價位</strong>。那類數字的算法本身就假設了事件是原因。
          這一頁只做一件事：把有日期的事實和大盤的價格畫在同一條時間軸上。怎麼解讀，由你自己決定。
        </p>
        <p class="macro-events-page__line">
          時間範圍受限於指數資料本身，最早到 {{ firstMonth }}。更早的事件（例如 1997 年亞洲金融風暴）沒有對應的指數線可以對照，因此不列入。
        </p>
        <p class="macro-events-page__line">資料來源：臺灣證券交易所（加權股價指數）；各事件的宣告出處見上方表格。</p>
      </el-card>
    </StockQuestionSection>
  </div>
</template>

<style scoped>
.macro-events-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.macro-events-page__title {
  margin: 0;
  font-size: 1.5rem;
}

.macro-events-page__card {
  border-radius: 12px;
}

.macro-events-page__line {
  margin: 0 0 12px;
  font-size: 1rem;
  line-height: 1.7;
}

.macro-events-page__line:last-child {
  margin-bottom: 0;
}

/* The corner sits over the chart's own top-right, the same placement every stock-detail chart card
   uses（「請放在卡片右上角」）. The card needs position:relative for that, and the chart needs top
   padding so the controls never cover the plot area's first gridline. */
.macro-events-page__chart-card {
  position: relative;
}

.macro-events-page__corner {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.macro-events-page__chart {
  width: 100%;
  height: 420px;
  padding-top: 40px;
}

.macro-events-page__caveat {
  margin: 12px 0 0;
  font-size: 1rem;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}
</style>
