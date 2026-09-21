<script setup lang="ts">
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, MarkLineComponent } from 'echarts/components'
import type { RateCyclePageData } from '#shared/types/hub'
import { clampDescription } from '~/utils/stock-digest'
import { getAccentColor, getChartInk, CHART_TOOLTIP, CHART_TOOLTIP_INK } from '~/utils/chart-palette'

// /macro/policy-rate — 政策利率與大盤（2026-09-21, moved under /macro on 2026-09-22）. The first
// page in this app about neither a company nor a metric, and the first member of 總經特區.
//
// It shipped at /rate-cycle and moved the next day（「搬進特區的網址結構下」）once that zone was
// called for. The move cost nothing: the page was one day old, committed but never pushed, so no
// live URL and no sitemap entry existed to preserve — unlike every slug rename in this repo so far
//（graham-number, financial-resilience, dividend-stability）where the old spelling stayed exactly
// because it WAS live. Worth recording the difference so the next rename doesn't cite this one as
// precedent for moving a published URL.
//
// ONE market-wide page rather than one per symbol, by direct decision（「升降息圖要配合大盤走勢」）
// after the alternative was costed: a rate decision is a market-wide event, so a per-stock version
// would have been ~2,600 URLs whose content is 95% the same rate history with a different line
// under it — the thin-content shape this app rejects everywhere else. It also would have been
// SHALLOWER: /stocks/:symbol/daily-price-history caps at 1,431 rows（2020-11 onwards, 6 events）,
// while the monthly index series reaches 1999 and covers 56.
//
// NO CAUSAL CLAIM ANYWHERE, and this page needed that rule more than most. The whole premise a
// reader brings to it —「升息會不會讓股市跌」— is exactly the sentence this app may not write:
// there is no published, citable rule for it the way 三率三升 has one, so the page states WHEN the
// rate changed and BY HOW MUCH, draws the index beside it, and stops. Every sentence below is a
// dated fact or an arithmetic one; the reader does the reading.
//
// An unregistered ECharts series type or component throws NOTHING — it silently draws nothing
// (found 2026-09-21 by counting rendered shapes). MarkLineComponent is the one this page needs
// that no other chart here did.
use([SVGRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent])

const { data, error } = await useFetch<RateCyclePageData>('/api/hub/macro-policy-rate', { key: 'hub-macro-policy-rate' })
if (error.value || !data.value) throw createError({ statusCode: 503, statusMessage: '升降息資料暫時無法取得', fatal: true })

// bff-ts returns both series oldest-first. The table reads newest-first（the most recent decision
// is what a visitor came for）; the chart keeps the ascending order — time runs left to right.
const events = computed(() => data.value?.events ?? [])
const eventsDesc = computed(() => [...events.value].reverse())
const taiex = computed(() => data.value?.taiex ?? [])

const latest = computed(() => eventsDesc.value[0] ?? null)

const rateText = (value: number): string => `${value.toFixed(3)}%`

// Log-axis ticks land on even steps in LOG space (10^3.7 = 5011.87…), which read as noise as
// labels; rounding to two significant figures moves the label by well under 1% of its own value.
// Same helper StockValuationRiverChart uses, for the same reason — the two are the app's only
// log-axis charts.
function formatAxisIndex(value: number): string {
  if (value <= 0) return ''
  const unit = Math.pow(10, Math.floor(Math.log10(value)) - 1)
  return String(Math.round(value / unit) * unit)
}
// 一碼 = 0.25% = 25bp is this market's own unit for talking about rate moves, so the page states
// both: the basis points are exact, the 碼 are what a news report says.
function changeText(changeBp: number | null): string {
  if (changeBp === null) return '—'
  const sign = changeBp > 0 ? '升息' : '降息'
  const notches = Math.abs(changeBp) / 25
  const notchText = notches === 0.5 ? '半碼' : notches === 1 ? '一碼' : `${notches} 碼`
  return `${sign}${notchText}（${changeBp > 0 ? '+' : '−'}${Math.abs(changeBp)} 基點）`
}

const hikes = computed(() => events.value.filter(event => (event.changeBp ?? 0) > 0).length)
const cuts = computed(() => events.value.filter(event => (event.changeBp ?? 0) < 0).length)

const latestAnswer = computed(() => {
  const event = latest.value
  if (!event) return null
  return `央行最近一次調整政策利率是 ${event.effectiveDate} 生效，重貼現率 ${rateText(event.discountRate)}，${changeText(event.changeBp)}。自 ${events.value[0]?.effectiveDate ?? ''} 起共 ${events.value.length} 次調整，其中升息 ${hikes.value} 次、降息 ${cuts.value} 次。`
})

const spanAnswer = computed(() => {
  const list = taiex.value
  if (list.length < 2) return null
  return `下圖為加權股價指數的月收盤（共 ${list.length} 個月，${list[0]!.tradeDate} 至 ${list[list.length - 1]!.tradeDate}），與同期間央行重貼現率的變動疊在同一個時間軸上。利率為階梯狀，因為它只在決議生效當天改變。`
})

const tableAnswer = computed(() => {
  if (!events.value.length) return null
  return `以下為由新到舊的每一次政策利率調整，共 ${events.value.length} 筆。日期為生效日——央行公布的統計只記生效日，理監事會通常在前一天。`
})

const { breadcrumbs } = useHubPageSeo({
  title: '台股大盤走勢與央行升降息紀錄',
  description: () => clampDescription(latestAnswer.value ?? '中央銀行政策利率（重貼現率）歷次調整紀錄，與加權股價指數月收盤對照。'),
  path: '/macro/policy-rate',
  // Two levels, not three: 總經特區 has no index page yet because it would have exactly one link
  // on it today — the thin page this app rejects everywhere else. The level goes in when the zone
  // has enough members to be worth browsing.
  breadcrumbs: [
    { label: '首頁', to: '/' },
    { label: '政策利率與大盤', to: '/macro/policy-rate' }
  ]
})

const { resolvedMode, color: accentColorName } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))

interface AxisTooltipParam { dataIndex?: number }

// Two axes, deliberately, after rejecting one for the 營收年增 × 股價 idea on the same day. The
// objection there was that a dual axis lets arbitrary scaling manufacture an apparent correlation
// between two series a reader is being invited to compare. It does not apply the same way here:
// the rate is a STEP function drawn as a step, so it cannot be mistaken for a second price line,
// and it is a policy instrument rather than a market outcome. The alternative — normalising both
// to an index — would have been worse, since it erases the actual rate level, which is the number
// a reader wants.
const chartOption = computed(() => {
  const points = taiex.value
  const labels = points.map(point => point.tradeDate)
  // The rate carried forward across every month until the next decision — a step series, which is
  // literally how a policy rate behaves. Months before the first event in the window get null so
  // the line starts where the data does rather than at an invented level.
  const byMonth = labels.map(date => {
    let current: number | null = null
    for (const event of events.value) {
      if (event.effectiveDate <= date) current = event.discountRate
      else break
    }
    return current
  })
  const accent = getAccentColor(resolvedMode.value, accentColorName.value)
  // Log axis for the index（2026-09-21,「大盤股價要用LOG 不然早期的數據會被擠成一條線」）— the
  // series runs 3,637 to 47,181 over this window, a 13× range, and on a linear axis the whole of
  // 1999–2009 flattens into a band at the bottom. Log gives equal PERCENTAGE moves equal visual
  // distance, which is also the more honest read against a rate cycle: a 10% index move means the
  // same thing at 5,000 as at 25,000. Same reasoning, same helper, as the river charts'.
  //
  // min/max pinned to what is actually PLOTTED. Left unpinned a log axis rounds out to the next
  // power of ten（1,000 to 100,000 here）, which would leave most of the chart empty — the exact
  // failure StockValuationRiverChart's own axisExtent comment records.
  const closes = points.map(point => point.close).filter(close => close > 0)
  const indexExtent = closes.length ? { min: Math.min(...closes), max: Math.max(...closes) } : null
  return {
    textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
    grid: { left: 8, right: 8, top: 48, bottom: 28, containLabel: true },
    legend: { top: 0, textStyle: { color: chartInk.value.muted, fontSize: 16 } },
    tooltip: {
      trigger: 'axis',
      appendTo: 'body',
      backgroundColor: CHART_TOOLTIP.backgroundColor,
      borderColor: CHART_TOOLTIP.borderColor,
      textStyle: { color: CHART_TOOLTIP_INK.primary },
      formatter: (params: AxisTooltipParam | AxisTooltipParam[]) => {
        const index = (Array.isArray(params) ? params[0] : params)?.dataIndex ?? 0
        const point = points[index]
        if (!point) return ''
        const rate = byMonth[index] ?? null
        const decided = events.value.find(event => event.effectiveDate.slice(0, 7) === point.tradeDate.slice(0, 7))
        return `<div style="font-size:1rem"><div style="font-weight:600;margin-bottom:4px">${point.tradeDate}</div>`
          + `<div>加權指數 ${point.close.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}</div>`
          + (rate === null ? '' : `<div>重貼現率 ${rateText(rate)}</div>`)
          + (decided ? `<div style="color:${CHART_TOOLTIP_INK.secondary}">本月 ${changeText(decided.changeBp)}</div>` : '')
          + '</div>'
      }
    },
    xAxis: {
      type: 'category',
      data: labels,
      axisLine: { lineStyle: { color: chartInk.value.baseline } },
      axisTick: { show: false },
      axisLabel: { color: chartInk.value.muted, fontSize: 16 }
    },
    yAxis: [
      {
        type: 'log',
        logBase: 10,
        name: '指數',
        nameTextStyle: { color: chartInk.value.muted, fontSize: 16 },
        ...(indexExtent ? { min: indexExtent.min, max: indexExtent.max } : {}),
        splitLine: { lineStyle: { color: chartInk.value.gridline } },
        axisLabel: { color: chartInk.value.muted, fontSize: 16, formatter: formatAxisIndex }
      },
      {
        type: 'value',
        name: '重貼現率 %',
        nameTextStyle: { color: chartInk.value.muted, fontSize: 16 },
        splitLine: { show: false },
        axisLabel: { color: chartInk.value.muted, fontSize: 16, formatter: (value: number) => `${value}%` }
      }
    ],
    series: [
      {
        name: '加權股價指數（月收盤）',
        type: 'line',
        yAxisIndex: 0,
        showSymbol: false,
        smooth: false,
        lineStyle: { width: 2, color: accent },
        itemStyle: { color: accent },
        data: points.map(point => point.close)
      },
      {
        name: '重貼現率',
        type: 'line',
        yAxisIndex: 1,
        // The step IS the honest shape: a policy rate holds flat until a decision changes it, and
        // drawing it smooth would imply a gradual drift that never happened.
        step: 'end',
        showSymbol: false,
        lineStyle: { width: 2, type: 'dashed', color: chartInk.value.primary },
        itemStyle: { color: chartInk.value.primary },
        connectNulls: false,
        data: byMonth
      }
    ]
  }
})
</script>

<template>
  <div class="macro-policy-rate-page">
    <h1 class="macro-policy-rate-page__title">台股大盤走勢與央行升降息紀錄</h1>
    <StockBreadcrumb :items="breadcrumbs" />

    <section class="stock-page-section" aria-labelledby="macro-policy-rate-latest-heading">
      <h2 id="macro-policy-rate-latest-heading" class="stock-page-section__title">央行最近一次升降息是什麼時候？</h2>
      <p v-if="latestAnswer" class="hub-answer">{{ latestAnswer }}</p>
    </section>

    <section class="stock-page-section" aria-labelledby="macro-policy-rate-chart-heading">
      <h2 id="macro-policy-rate-chart-heading" class="stock-page-section__title">升降息期間大盤走勢如何？</h2>
      <p v-if="spanAnswer" class="hub-answer">{{ spanAnswer }}</p>
      <el-card shadow="never" class="macro-policy-rate-page__card">
        <SharedChart v-if="taiex.length > 1" class="macro-policy-rate-page__chart" :option="chartOption" :init-options="{ renderer: 'svg' }" autoresize />
      </el-card>
    </section>

    <section class="stock-page-section" aria-labelledby="macro-policy-rate-table-heading">
      <h2 id="macro-policy-rate-table-heading" class="stock-page-section__title">歷次政策利率調整有哪些？</h2>
      <p v-if="tableAnswer" class="hub-answer">{{ tableAnswer }}</p>
      <SharedTableScroll label="中央銀行政策利率歷次調整">
        <table class="seo-table" data-ssr-table>
          <caption>中央銀行政策利率歷次調整（由新到舊，日期為生效日）</caption>
          <thead>
            <tr>
              <th scope="col">生效日</th>
              <th scope="col">重貼現率</th>
              <th scope="col">調整幅度</th>
              <th scope="col">擔保放款融通利率</th>
              <th scope="col">短期融通利率</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="event in eventsDesc" :key="event.effectiveDate">
              <th scope="row">{{ event.effectiveDate }}</th>
              <td>{{ rateText(event.discountRate) }}</td>
              <td>{{ changeText(event.changeBp) }}</td>
              <td>{{ rateText(event.collateralAccommodationRate) }}</td>
              <td>{{ rateText(event.unsecuredAccommodationRate) }}</td>
            </tr>
          </tbody>
        </table>
      </SharedTableScroll>
      <p class="hub-answer macro-policy-rate-page__sources">資料來源：中央銀行重貼現率及融通利率統計、臺灣證券交易所加權股價指數。</p>
    </section>
  </div>
</template>

<style scoped>
.macro-policy-rate-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.macro-policy-rate-page__title {
  margin: 0;
  font-size: 1.5rem;
}

.macro-policy-rate-page__chart {
  width: 100%;
  height: 420px;
}

.macro-policy-rate-page__sources {
  margin-top: 16px;
  color: var(--el-text-color-secondary);
}
</style>
