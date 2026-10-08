<script setup lang="ts">
import type { RateCyclePageData } from '#shared/types/hub'
// /macro/policy-rate — 政策利率與大盤（2026-09-21；09-22 由 /rate-cycle 搬進 /macro。那時頁面只有一天大、沒上線過，所以沒留
// 舊網址——這是全站唯一不設轉址的改名，別拿它當先例）。一頁一市場、不做每檔一頁（利率決議是全市場事件，2,600 頁會是 95% 相同
// 的內容）。不做任何因果宣稱：「升息會不會讓股市跌」沒有可引用的規則，頁面只寫哪一天改了多少、把指數畫在旁邊。
// 圖的做法（對數軸、雙軸、階梯線）在 rateCycleChartOption，三個利率頁共用。

const { data, error } = await useFetch<RateCyclePageData>('/api/hub/macro-policy-rate', { key: 'hub-macro-policy-rate' })
if (error.value || !data.value) throw createError({ statusCode: 503, statusMessage: '升降息資料暫時無法取得', fatal: true })

// bff 兩份序列都由舊到新；表由新到舊（最近一次是讀者來看的），圖維持由舊到新
const events = computed(() => data.value?.events ?? [])
const eventsDesc = computed(() => [...events.value].reverse())
const taiex = computed(() => data.value?.taiex ?? [])
const latest = computed(() => eventsDesc.value[0] ?? null)

const rateText = (value: number): string => `${value.toFixed(3)}%`

const hikes = computed(() => events.value.filter(event => (event.changeBp ?? 0) > 0).length)
const cuts = computed(() => events.value.filter(event => (event.changeBp ?? 0) < 0).length)

const latestAnswer = computed(() => {
  const event = latest.value
  if (!event) return null
  return `央行最近一次調整政策利率是 ${event.effectiveDate} 生效，重貼現率 ${rateText(event.discountRate)}，${rateChangeText(event.changeBp)}。自 ${events.value[0]?.effectiveDate ?? ''} 起共 ${events.value.length} 次調整，其中升息 ${hikes.value} 次、降息 ${cuts.value} 次。`
})

const spanAnswer = computed(() => rateCycleSpanAnswer(taiex.value, events.value, '央行重貼現率'))

const tableAnswer = computed(() => {
  if (!events.value.length) return null
  return `以下為由新到舊的每一次政策利率調整，共 ${events.value.length} 筆。日期為生效日——央行公布的統計只記生效日，理監事會通常在前一天。`
})

const { breadcrumbs } = useHubPageSeo({
  title: '台股大盤走勢與央行升降息紀錄',
  description: () => clampDescription(latestAnswer.value ?? '中央銀行政策利率（重貼現率）歷次調整紀錄，與加權股價指數月收盤對照。'),
  path: '/macro/policy-rate',
  breadcrumbs: [
    { label: '首頁', to: '/' },
    { label: '總經特區', to: '/macro' },
    { label: '政策利率與大盤', to: '/macro/policy-rate' }
  ]
})

const { resolvedMode, color } = useAppTheme()
const chartOption = computed(() => rateCycleChartOption(events.value, taiex.value, resolvedMode.value, color.value, {
  rateOf: event => event.discountRate,
  changeOf: event => event.changeBp,
  rateLabel: '重貼現率',
  seriesName: '重貼現率',
  axisName: '重貼現率 %',
  rateText
}))
</script>

<template>
  <div class="app-page app-page--compact macro-policy-rate-page">
    <h1 class="app-page__title macro-policy-rate-page__title">台股大盤走勢與央行升降息紀錄</h1>
    <StockBreadcrumb :items="breadcrumbs" />
    <MacroNav />

    <section class="stock-page-section" aria-labelledby="macro-policy-rate-latest-heading">
      <h2 id="macro-policy-rate-latest-heading" class="stock-page-section__title">央行最近一次升降息是什麼時候？</h2>
      <p v-if="latestAnswer" class="hub-answer">{{ latestAnswer }}</p>
    </section>

    <section class="stock-page-section" aria-labelledby="macro-policy-rate-chart-heading">
      <h2 id="macro-policy-rate-chart-heading" class="stock-page-section__title">升降息期間大盤走勢如何？</h2>
      <p v-if="spanAnswer" class="hub-answer">{{ spanAnswer }}</p>
      <el-card shadow="never" class="macro-policy-rate-page__card">
        <SharedChart v-if="taiex.length > 1" class="app-chart macro-policy-rate-page__chart" :option="chartOption" autoresize />
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
              <td>{{ rateChangeText(event.changeBp) }}</td>
              <td>{{ rateText(event.collateralAccommodationRate) }}</td>
              <td>{{ rateText(event.unsecuredAccommodationRate) }}</td>
            </tr>
          </tbody>
        </table>
      </SharedTableScroll>
      <p class="hub-answer hub-sources macro-policy-rate-page__sources">資料來源：中央銀行重貼現率及融通利率統計、臺灣證券交易所加權股價指數。</p>
    </section>
  </div>
</template>
