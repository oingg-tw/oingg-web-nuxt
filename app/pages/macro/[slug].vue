<script setup lang="ts">
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, MarkLineComponent } from 'echarts/components'
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
use([SVGRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent])

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

// 交叉：兩支序列的差改變正負號的那一期（2026-09-30）。純算術——「這個月 A 比 B 高，上個月不是」，
// 沒有任何關於之後會發生什麼的主張。名字用市場慣稱（黃金／死亡交叉），因為那是這個市場對這件事的
// 既有詞彙，不是本站的判斷；頁面只說哪一期換位，不說換位之後會怎樣。
//
// 實測（2026-09-30，1988-05 起 459 期兩支都有值）：共 33 次（黃金 16、死亡 17），2000 年以後 25 次。
// 其中有幾次是一兩個月內來回（2018-01 死叉、2018-02 黃金；2022-07/08/09 三個月三次），所以答句要
// 講出次數與最近一次，讀者才不會把單月的一次換位當成方向確立。
const crossovers = computed(() => {
  const config = page.crossover
  if (!config) return []
  const usable = rows.value.filter(row => row.values[config.aboveKey] != null && row.values[config.belowKey] != null)
  const out: { period: string; label: string }[] = []
  for (let i = 1; i < usable.length; i++) {
    const prev = usable[i - 1]!.values[config.aboveKey]! - usable[i - 1]!.values[config.belowKey]!
    const now = usable[i]!.values[config.aboveKey]! - usable[i]!.values[config.belowKey]!
    if (prev <= 0 && now > 0) out.push({ period: usable[i]!.period, label: config.aboveLabel })
    else if (prev >= 0 && now < 0) out.push({ period: usable[i]!.period, label: config.belowLabel })
  }
  return out
})

// 標記線用同一個中性色，不用漲跌紅綠：上穿與下穿是有方向的資訊，但「哪個方向比較好」是本站不做的
// 判斷，用顏色編那件事等於偷偷下了結論。方向由文字標籤講（黃金／死亡），位置由線講。
const crossoverMarkLine = computed(() => ({
  symbol: 'none',
  silent: true,
  label: { show: false },
  lineStyle: { color: chartInk.value.baseline, width: 1.5, type: 'dashed' },
  data: crossovers.value.map(item => ({ xAxis: item.period }))
}))

const crossoverAnswer = computed(() => {
  const list = crossovers.value
  const config = page.crossover
  if (!config || !list.length) return null
  const last = list[list.length - 1]!
  const above = list.filter(item => item.label === config.aboveLabel).length
  return `這段期間兩條線換位 ${list.length} 次（${config.aboveLabel} ${above} 次、${config.belowLabel} ${list.length - above} 次），最近一次是 ${last.period} 的${last.label}。換位就是兩個年增率的高低對調，下圖把同樣這幾期標在加權股價指數上。`
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
    { label: '總經特區', to: '/macro' },
    { label: page.topic, to: macroPagePath(slug) }
  ]
})

const { resolvedMode, color: accentColorName } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))

// Log for the index, linear for the macro series. The index spans 13× over this window and
// flattens its own first decade on a linear axis（the reason /macro/policy-rate switched）; a
// percentage or a score does not, and forcing log on it would distort a scale a reader reads
// directly.

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
        axisLabel: { color: chartInk.value.muted, fontSize: 16, formatter: formatLogAxisTick }
      }
    ],
    series: [
      ...page.series.map((spec, index) => ({
        name: spec.name,
        type: 'line',
        yAxisIndex: 0,
        symbol: spec.symbol,
        showSymbol: true,
        symbolSize: 8,
        lineStyle: { width: 2.5, type: spec.lineType, color: macroColors[index] ?? chartInk.value.primary },
        itemStyle: { color: macroColors[index] ?? chartInk.value.primary },
        // A gap stays a gap: the 1987 monetary rows genuinely have no year-on-year figure, and
        // joining across them would draw a line through data that was never reported.
        connectNulls: false,
        data: list.map(row => row.values[spec.key] ?? null)
      })),
      // 高齡友善規格（2026-09-30）：折線 ≤ 2 條、線寬 ≥ 2.5px、轉折點 8px 實心標記。
        // showSymbol 交給 ECharts 的密度判斷——月序列實測 333 點，全部畫成 8px 會連成一塊。
      {
        name: '加權股價指數',
        type: 'line',
        yAxisIndex: 1,
        showSymbol: true,
        symbolSize: 8,
        lineStyle: { width: 2.5, color: accent },
        itemStyle: { color: accent },
        data: list.map(row => row.close)
      }
    ]
  }
})

// 有 crossover 時改畫上下兩張：上圖只有兩支序列（共用左軸），下圖只有加權指數（對數軸）。兩張的
// x 軸資料一樣，所以垂直的標記線落在同一個位置，讀者可以用眼睛把上下對起來。
//
// x 軸刻度要**強制同一個間隔**：ECharts 的自動間隔看的是標籤會不會重疊，而兩張圖的左側軸標籤寬度
// 不同（上圖是 40/30/20，下圖是 46000/10000/3600），於是自動算出來的間隔差一格——實測上圖是
// 1999-01、2001-01、2003-01…，下圖是 1999-01、2001-02、2003-03…，越往右偏越多。兩張圖要互相對照，
// 刻度對不齊就毀了對照本身。
const sharedAxisInterval = computed(() => Math.max(1, Math.round(rows.value.length / 12)))
const sharedXAxis = computed(() => ({
  ...((chartOption.value as Record<string, unknown>).xAxis as Record<string, unknown>),
  axisLabel: {
    ...(((chartOption.value as Record<string, unknown>).xAxis as Record<string, { axisLabel?: object }>).axisLabel ?? {}),
    interval: sharedAxisInterval.value
  }
}))
const seriesChartOption = computed(() => {
  const base = chartOption.value as Record<string, unknown>
  const series = (base.series as Record<string, unknown>[]).slice(0, page.series.length)
  series[0] = { ...series[0], markLine: crossoverMarkLine.value }
  return {
    ...base,
    xAxis: sharedXAxis.value,
    yAxis: [(base.yAxis as unknown[])[0]],
    series
  }
})

const indexChartOption = computed(() => {
  const base = chartOption.value as Record<string, unknown>
  const all = base.series as Record<string, unknown>[]
  const indexSeries = { ...all[all.length - 1], yAxisIndex: 0, markLine: crossoverMarkLine.value }
  return {
    ...base,
    xAxis: sharedXAxis.value,
    legend: { ...(base.legend as Record<string, unknown>), show: false },
    yAxis: [(base.yAxis as unknown[])[1]],
    series: [indexSeries]
  }
})
</script>

<template>
  <div class="macro-page">
    <h1 class="macro-page__title">台股{{ page.topic }}與大盤對照</h1>
    <StockBreadcrumb :items="breadcrumbs" />
    <MacroNav />

    <section class="stock-page-section" aria-labelledby="macro-latest-heading">
      <h2 id="macro-latest-heading" class="stock-page-section__title">最新一期的{{ page.topic }}是多少？</h2>
      <p v-if="latestAnswer" class="hub-answer">{{ latestAnswer }}</p>
    </section>

    <section class="stock-page-section" aria-labelledby="macro-chart-heading">
      <h2 id="macro-chart-heading" class="stock-page-section__title">{{ page.topic }}與大盤走勢如何對照？</h2>
      <p v-if="spanAnswer" class="hub-answer">{{ spanAnswer }}</p>
      <template v-if="page.crossover">
        <p v-if="crossoverAnswer" class="hub-answer">{{ crossoverAnswer }}</p>
        <el-card shadow="never" class="macro-page__card">
          <SharedChart v-if="rows.length > 1" class="macro-page__chart" :option="seriesChartOption" autoresize />
        </el-card>
        <el-card shadow="never" class="macro-page__card">
          <SharedChart v-if="rows.length > 1" class="macro-page__chart" :option="indexChartOption" autoresize />
        </el-card>
      </template>
      <el-card v-else shadow="never" class="macro-page__card">
        <SharedChart v-if="rows.length > 1" class="macro-page__chart" :option="chartOption" autoresize />
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
