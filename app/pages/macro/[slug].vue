<script setup lang="ts">
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import type { MacroPageData } from '#shared/types/hub'
import { clampDescription } from '~/utils/stock-digest'
import { joinSentences } from '~/utils/stock-answers'
import { getAccentColor, getChartAccentGold, getChartInk, CHART_TOOLTIP, CHART_TOOLTIP_INK } from '~/utils/chart-palette'

// /macro/{slug} — 總經特區's shared template（2026-09-22,「Sidebar 就放不同指標跟大盤比較」）.
//
// Six pages, one template, driven by MACRO_PAGES in shared/utils/macro-pages.ts — the same call
// METRIC_PAGES/StockMetricDetailPage represent among the stock pages, and for the same reason:
// every page here asks one question shape（this series, against the index, over time）and differs
// only in which series and which words. /macro/policy-rate keeps its own route file because it is
// genuinely a different shape（discrete decision events, a five-column table）, and Nuxt resolves
// that static route before this catch-all.
//
// NO CAUSAL CLAIM, the standing rule this zone needs most. Every one of these pairings has a folk
// story attached —「M1B 黃金交叉代表資金流入股市」、「藍燈買紅燈賣」、「升息股市跌」— and not one
// of them is a published, citable rule the way 三率三升 is. So the page draws both series, states
// what each number is, and stops. The caveats in the registry are properties of the DATA（an axis
// that runs backwards, a one-month lag, a band definition published by the NDC）, never readings.
//
// An unregistered ECharts piece throws nothing and silently draws nothing — found 2026-09-21 by
// counting shapes rather than eyeballing.
use([SVGRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent])

const route = useRoute()
const slug = String(route.params.slug)
const page = findMacroPage(slug)
if (!page) throw createError({ statusCode: 404, statusMessage: '找不到這個總經頁面', fatal: true })

const { data, error } = await useFetch<MacroPageData>(`/api/hub/macro/${slug}`, { key: `hub-macro-${slug}` })
if (error.value || !data.value) throw createError({ statusCode: 503, statusMessage: '總經資料暫時無法取得', fatal: true })

// The two series are joined on `period`, not on array index: they come from different upstreams
// with different start dates（CPI from 1981, the index from 1999）, so only the overlap can be
// drawn. Anything outside it would be one line floating over an empty axis.
const rows = computed(() => {
  const indexByPeriod = new Map(data.value?.taiex.map(point => [point.period, point.close]) ?? [])
  return (data.value?.series ?? [])
    .filter(point => indexByPeriod.has(point.period))
    .map(point => ({ period: point.period, values: point.values, close: indexByPeriod.get(point.period)! }))
})

const rowsDesc = computed(() => [...rows.value].reverse())
const latest = computed(() => rowsDesc.value[0] ?? null)

const unit = page.unit
const valueText = (value: number | null | undefined, decimals = 2): string =>
  value === null || value === undefined ? '尚無資料' : `${value.toFixed(decimals)}${unit}`
const seriesValueText = (row: { values: Record<string, number | null> }, spec: { key: string; decimals?: number }): string =>
  valueText(row.values[spec.key], spec.decimals ?? 2)

const cadenceWord = page.cadence === 'quarterly' ? '每季' : '每月'

const latestAnswer = computed(() => {
  const row = latest.value
  if (!row) return null
  // A single series whose name IS the page's topic would otherwise read「的10 年期公債殖利率：
  // 10 年期公債殖利率 1.90%」— the label twice in one clause. Two series always keep their names,
  // since telling M1B from M2 is the point of that page.
  const single = page.series.length === 1 && page.series[0]!.name === page.topic
  const parts = page.series.map(spec => (single ? seriesValueText(row, spec) : `${spec.name} ${seriesValueText(row, spec)}`))
  return `${row.period} 的${page.topic}：${parts.join('、')}。同期加權股價指數收在 ${row.close.toLocaleString('zh-TW', { maximumFractionDigits: 0 })} 點。`
})

// Two wordings of the same fact: the page says「下圖」because the chart is right there, the meta
// description cannot — in a search snippet there is no 下圖 to point at.
const spanFacts = computed(() => {
  const list = rows.value
  if (list.length < 2) return null
  return `${cadenceWord}一點，共 ${list.length} 期，涵蓋 ${list[0]!.period} 至 ${list[list.length - 1]!.period}`
})

const spanAnswer = computed(() =>
  spanFacts.value ? `下圖為${page.topic}與加權股價指數的對照，${spanFacts.value}。兩者起始時間不同，只畫兩邊都有資料的期間。` : null
)

const spanDescription = computed(() =>
  spanFacts.value ? `${page.topic}與加權股價指數的歷年對照，${spanFacts.value}。` : null
)

const { breadcrumbs } = useHubPageSeo({
  title: `台股${page.titleKeywords}`,
  // BOTH sentences, not just the latest reading: check-hub-pages holds every hub description to
  // 60–90 CJK-equivalent characters and the latest-value sentence alone measures 31–45 depending
  // on the page（caught by that check, not by eye）. The span sentence carries the cadence and the
  // covered range, which is genuinely what a searcher wants to know about a historical series.
  description: () => clampDescription(joinSentences([latestAnswer.value, spanDescription.value]) ?? `${page.topic}與加權股價指數的歷年對照。`),
  path: macroPagePath(slug),
  breadcrumbs: [
    { label: '首頁', to: '/' },
    { label: page.topic, to: macroPagePath(slug) }
  ]
})

const { resolvedMode, color: accentColorName } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))

// Log for the index, linear for the macro series. The index spans 13× over this window and
// flattens its own first decade on a linear axis（the reason /macro/policy-rate switched）; a
// percentage or a score does not, and forcing log on it would distort a scale a reader reads
// directly.
function formatAxisIndex(value: number): string {
  if (value <= 0) return ''
  const step = Math.pow(10, Math.floor(Math.log10(value)) - 1)
  return String(Math.round(value / step) * step)
}

interface AxisTooltipParam { dataIndex?: number }

const chartOption = computed(() => {
  const list = rows.value
  const accent = getAccentColor(resolvedMode.value, accentColorName.value)
  const macroColors = [chartInk.value.primary, getChartAccentGold(resolvedMode.value)]
  const closes = list.map(row => row.close).filter(close => close > 0)
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
        const row = list[(Array.isArray(params) ? params[0] : params)?.dataIndex ?? 0]
        if (!row) return ''
        const lines = page.series.map(spec => `<div>${spec.name} ${seriesValueText(row, spec)}</div>`).join('')
        return `<div style="font-size:1rem"><div style="font-weight:600;margin-bottom:4px">${row.period}</div>${lines}`
          + `<div style="color:${CHART_TOOLTIP_INK.secondary}">加權指數 ${row.close.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}</div></div>`
      }
    },
    xAxis: {
      type: 'category',
      data: list.map(row => row.period),
      axisLine: { lineStyle: { color: chartInk.value.baseline } },
      axisTick: { show: false },
      axisLabel: { color: chartInk.value.muted, fontSize: 16 }
    },
    yAxis: [
      {
        type: 'value',
        name: unit,
        nameTextStyle: { color: chartInk.value.muted, fontSize: 16 },
        splitLine: { lineStyle: { color: chartInk.value.gridline } },
        axisLabel: { color: chartInk.value.muted, fontSize: 16 }
      },
      {
        type: 'log',
        logBase: 10,
        name: '指數',
        nameTextStyle: { color: chartInk.value.muted, fontSize: 16 },
        ...(indexExtent ? { min: indexExtent.min, max: indexExtent.max } : {}),
        splitLine: { show: false },
        axisLabel: { color: chartInk.value.muted, fontSize: 16, formatter: formatAxisIndex }
      }
    ],
    series: [
      ...page.series.map((spec, index) => ({
        name: spec.name,
        type: 'line',
        yAxisIndex: 0,
        symbol: spec.symbol,
        showSymbol: false,
        lineStyle: { width: 2, type: spec.lineType, color: macroColors[index] ?? chartInk.value.primary },
        itemStyle: { color: macroColors[index] ?? chartInk.value.primary },
        // A gap stays a gap: the 1987 monetary rows genuinely have no year-on-year figure, and
        // joining across them would draw a line through data that was never reported.
        connectNulls: false,
        data: list.map(row => row.values[spec.key] ?? null)
      })),
      {
        name: '加權股價指數',
        type: 'line',
        yAxisIndex: 1,
        showSymbol: false,
        lineStyle: { width: 2, color: accent },
        itemStyle: { color: accent },
        data: list.map(row => row.close)
      }
    ]
  }
})
</script>

<template>
  <div class="macro-page">
    <h1 class="macro-page__title">台股{{ page.topic }}與大盤對照</h1>
    <StockBreadcrumb :items="breadcrumbs" />
    <MacroNav :current="slug" />

    <section class="stock-page-section" aria-labelledby="macro-latest-heading">
      <h2 id="macro-latest-heading" class="stock-page-section__title">最新一期的{{ page.topic }}是多少？</h2>
      <p v-if="latestAnswer" class="hub-answer">{{ latestAnswer }}</p>
    </section>

    <section class="stock-page-section" aria-labelledby="macro-chart-heading">
      <h2 id="macro-chart-heading" class="stock-page-section__title">{{ page.topic }}與大盤走勢如何對照？</h2>
      <p v-if="spanAnswer" class="hub-answer">{{ spanAnswer }}</p>
      <el-card shadow="never" class="macro-page__card">
        <SharedChart v-if="rows.length > 1" class="macro-page__chart" :option="chartOption" :init-options="{ renderer: 'svg' }" autoresize />
      </el-card>
      <p v-if="page.caveat" class="hub-answer macro-page__caveat">{{ page.caveat }}</p>
    </section>

    <section class="stock-page-section" aria-labelledby="macro-table-heading">
      <h2 id="macro-table-heading" class="stock-page-section__title">{{ page.topic }}的逐期數據是什麼？</h2>
      <SharedTableScroll :label="`${page.topic}與加權股價指數逐期數據`">
        <table class="seo-table" data-ssr-table>
          <caption>{{ page.topic }}與加權股價指數（由新到舊，{{ cadenceWord }}一期）</caption>
          <thead>
            <tr>
              <th scope="col">期別</th>
              <th v-for="spec in page.series" :key="spec.key" scope="col">{{ spec.name }}{{ unit ? `（${unit}）` : '' }}</th>
              <th scope="col">加權股價指數</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rowsDesc" :key="row.period">
              <th scope="row">{{ row.period }}</th>
              <td v-for="spec in page.series" :key="spec.key">{{ seriesValueText(row, spec) }}</td>
              <td>{{ row.close.toLocaleString('zh-TW', { maximumFractionDigits: 0 }) }}</td>
            </tr>
          </tbody>
        </table>
      </SharedTableScroll>
      <p class="hub-answer macro-page__sources">資料來源：中央銀行、行政院主計總處、國家發展委員會、臺灣證券交易所加權股價指數。</p>
    </section>
  </div>
</template>

<style scoped>
.macro-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.macro-page__title {
  margin: 0;
  font-size: 1.5rem;
}

.macro-page__chart {
  width: 100%;
  height: 420px;
}

.macro-page__caveat,
.macro-page__sources {
  margin-top: 16px;
  color: var(--el-text-color-secondary);
}
</style>
