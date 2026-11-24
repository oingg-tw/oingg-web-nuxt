<script setup lang="ts">
import type { LineSeriesSpec } from '~/components/stock/StockMultiSeriesLineChart.vue'
import type { MacroPageData } from '#shared/types/hub'
import type { MacroPageDefinition } from '#shared/utils/macro-pages'

// 總經的參考序列頁（2026-11-24，使用者 11-23：總經頁加回來、不疊大盤）：最新一期一句話、走勢圖（近N年與自訂區間）、這一頁自己的第二段
//（M2 組成、CPI 分項、各需求項目）、近 5 年的逐期表、定義與出處。只寫數字是什麼，不寫對股市的解讀
const props = defineProps<{ page: MacroPageDefinition; data: MacroPageData }>()

const unit = props.page.unit
const valueText = (value: number | null | undefined) => (value === null || value === undefined ? '尚無資料' : minusSign(`${value.toFixed(2)}${unit === '%' ? '%' : ` ${unit}`}`))
// 頭尾每一支都沒有值的期別不畫（1987 年貨幣總計數的頭 12 個月沒有年增率），中間的留空白
const points = computed(() => trimEmptyEnds(props.data.series, point => props.page.series.some(spec => point.values[spec.key] != null)))
const latest = computed(() => points.value.at(-1) ?? null)

const answer = computed(() => {
  const row = latest.value
  if (!row) return `目前沒有${props.page.topic}的資料。`
  const single = props.page.series.length === 1
  const parts = props.page.series.map(spec => (single ? valueText(row.values[spec.key]) : `${spec.name} ${valueText(row.values[spec.key])}`))
  return `${row.period} 的${props.page.topic}：${parts.join('、')}。`
})

const entries = computed(() => points.value.map(point => ({ label: point.period, values: Object.fromEntries(props.page.series.map(spec => [spec.key, { value: point.values[spec.key] ?? null }])) })))
const series = computed<LineSeriesSpec[]>(() => props.page.series.map(spec => ({ code: spec.key, name: spec.name, lineType: spec.lineType, symbol: spec.symbol, format: valueText })))
const perYear = props.page.quarterly ? 4 : 12
const { period, shown } = useChartPeriod({ all: entries, keyOf: entry => entry.label, perYear })

// 逐期表：最近 12 個月或 8 季，新的在上（月資料 5 年是 60 列，表比圖還長；更早的看圖的自訂區間）
const tableCount = props.page.quarterly ? 8 : 12
const tableRows = computed(() => [...points.value].reverse().slice(0, tableCount))
const tableHeading = props.page.quarterly ? '最近 8 季' : '最近 12 個月'
const cadence = props.page.quarterly ? '每季一期' : '每月一期'

useHubPageSeo({
  title: `台股總經：${props.page.titleKeywords}`,
  description: () => clampDescription(`${answer.value}${props.page.titleKeywords}的歷年走勢與${tableHeading}的數字，${cadence}，資料來源：${props.page.source}。`),
  path: macroPagePath(props.page.slug),
  breadcrumbs: [
    { label: '首頁', to: '/' },
    { label: '總經特區', to: '/macro' },
    { label: props.page.topic, to: macroPagePath(props.page.slug) }
  ]
})
const breadcrumbs = [
  { label: '首頁', to: '/' },
  { label: '總經特區', to: '/macro' },
  { label: props.page.topic, to: macroPagePath(props.page.slug) }
]
</script>

<template>
  <div class="app-page app-page--compact macro-page">
    <h1 class="app-page__title">{{ page.titleKeywords }}</h1>
    <StockBreadcrumb :items="breadcrumbs" />
    <MacroNav />

    <section class="stock-page-section" aria-labelledby="macro-latest-heading">
      <h2 id="macro-latest-heading" class="stock-page-section__title">最新一期的{{ page.topic }}是多少？</h2>
      <p class="hub-answer">{{ answer }}</p>
      <SharedChartCard v-if="entries.length > 1" :period="period">
        <StockMultiSeriesLineChart :entries="shown" :series="series" palette="accent" :unit="unit" :format="valueText" />
      </SharedChartCard>
    </section>

    <MacroCompositionSection v-if="data.composition?.length" :rows="data.composition" />
    <MacroCpiItemsSection v-if="data.cpiItems?.length" :items="data.cpiItems" />
    <MacroGdpComponentsSection v-if="data.gdpComponents?.length" :components="data.gdpComponents" />

    <section v-if="tableRows.length" class="stock-page-section" aria-labelledby="macro-table-heading">
      <h2 id="macro-table-heading" class="stock-page-section__title">{{ tableHeading }}的{{ page.topic }}</h2>
      <SharedTable caption-visible :label="`${page.topic}逐期數據`" :caption="`${page.topic}（由新到舊，${cadence}）`">
        <thead>
          <tr>
            <th scope="col">期別</th>
            <th v-for="spec in page.series" :key="spec.key" scope="col" class="seo-table__num">{{ spec.name }}（{{ unit }}）</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in tableRows" :key="row.period">
            <th scope="row">{{ row.period }}</th>
            <td v-for="spec in page.series" :key="spec.key" class="seo-table__num">{{ row.values[spec.key] == null ? '－' : minusSign(row.values[spec.key]!.toFixed(2)) }}</td>
          </tr>
        </tbody>
      </SharedTable>
    </section>

    <StockMetricGuide id-prefix="macro" :topic="page.topic" :definition-question="`${page.topic}是什麼？`" :definition="[...(page.guide ?? []), `資料來源：${page.source}。`]" />
  </div>
</template>
