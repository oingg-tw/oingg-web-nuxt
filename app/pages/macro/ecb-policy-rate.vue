<script setup lang="ts">
import type { EcbRateCycleEvent, RateCyclePageData } from '#shared/types/hub'
import { clampDescription } from '~/utils/stock-digest'

// /macro/ecb-policy-rate — 歐洲央行升降息紀錄（2026-09-30），跟央行與聯準會那兩頁同一種形狀。
// **圖上畫存款機制利率（DFR），不是主要再融資利率（MRO）**：2024 年起 ECB 自己的政策訊號就是 DFR，畫 MRO 會讓最近幾次真的
// 調整在線上看起來沒動。表格三支都列，讀者拿我們的數字去對新聞上的 MRO 才對得起來。
// 量過才知道的事（實測 69 列，與 gov-ts 的正式庫逐項吻合）：21 列的主要再融資是「最低投標利率」（2000-06-28～2008-10-14 的
// 變動利率標售）；7 列的 MRO 幅度是 0（只調走廊上下緣）；5 列的 DFR 是負的（2014–2022）；2000-06-28 三支幅度都是 0，變的只有
// 標售機制。1999-01-01 是歐元啟用日也是資料的真實起點，所以表格就是完整歷史。
// 不做任何因果宣稱：圖上的指數是台灣的、利率是歐元區的。圖的做法在 rateCycleChartOption。

const { data, error } = await useFetch<RateCyclePageData<EcbRateCycleEvent>>('/api/hub/macro-ecb-policy-rate', { key: 'hub-macro-ecb-policy-rate' })
if (error.value || !data.value) throw createError({ statusCode: 503, statusMessage: '歐洲央行利率資料暫時無法取得', fatal: true })

const events = computed(() => data.value?.events ?? [])
const eventsDesc = computed(() => [...events.value].reverse())
const taiex = computed(() => data.value?.taiex ?? [])
const latest = computed(() => eventsDesc.value[0] ?? null)

const rateText = (value: number): string => `${value.toFixed(2)}%`
const optionalRate = (value: number | null): string => (value === null ? '—' : rateText(value))

// 那 21 列的主要再融資是「最低投標利率」：在 2000-06-28～2008-10-14 之間「固定標售利率」根本不存在，照同一個名字寫會把一個
// 當年沒有的概念套到那段歷史上
const mroLabel = (event: { mainRefinancingIsMinimumBid: boolean }): string =>
  event.mainRefinancingIsMinimumBid ? '最低投標利率' : '主要再融資利率'

// 用存款機制利率的幅度數升降息，不是主要再融資：圖上畫的是它，答句也該跟圖一致
const hikes = computed(() => events.value.filter(event => (event.depositFacilityChangeBp ?? 0) > 0).length)
const cuts = computed(() => events.value.filter(event => (event.depositFacilityChangeBp ?? 0) < 0).length)
// DFR 持平、但主要再融資有動的那幾列（2026-10-01 實測 4 次：2008-10-15、2009-05-13、2013-05-08、2013-11-13，後三次當年的新聞
// 頭條就是「ECB 降息」——DFR 已經在 0 降不下去，ECB 只能動 MRO）。它們不在上面的升降息次數裡，是「用單一支利率數升降息」的
// 真正代價，必須在頁面上講出來，否則表格裡會有四列沒有解釋的空白幅度。
const dfrFlatMroMoves = computed(() =>
  events.value.filter(event => event.depositFacilityChangeBp === 0 && (event.mainRefinancingChangeBp ?? 0) !== 0)
)
const mroOnlyCuts = computed(() => dfrFlatMroMoves.value.filter(event => (event.mainRefinancingChangeBp ?? 0) < 0).length)
// 三支幅度都是 0 的那幾列——只有 2000-06-28，變的是標售機制。1999-01-01 的幅度是 null 不是 0，嚴格比較把它排除是對的：
// 啟用不是一次「調整」。
const regimeSwitches = computed(() =>
  events.value.filter(event =>
    event.depositFacilityChangeBp === 0 && event.mainRefinancingChangeBp === 0 && event.marginalLendingChangeBp === 0)
)

const latestAnswer = computed(() => {
  const event = latest.value
  if (!event) return null
  return `歐洲央行最近一次調整政策利率是 ${event.effectiveDate} 生效，存款機制利率 ${optionalRate(event.depositFacilityRate)}、主要再融資利率 ${optionalRate(event.mainRefinancingRate)}、邊際貸款利率 ${optionalRate(event.marginalLendingRate)}，存款機制利率${rateChangeText(event.depositFacilityChangeBp)}。自 ${events.value[0]?.effectiveDate ?? ''} 歐元啟用起共 ${events.value.length} 次調整，其中存款機制利率升息 ${hikes.value} 次、降息 ${cuts.value} 次${dfrFlatMroMoves.value.length ? `，另有 ${dfrFlatMroMoves.value.length} 次存款機制利率沒動、只調主要再融資利率，${mroOnlyCuts.value === dfrFlatMroMoves.value.length ? '全部是調降' : `其中 ${mroOnlyCuts.value} 次是調降`}` : ''}。`
})

const spanAnswer = computed(() => rateCycleSpanAnswer(taiex.value, events.value, '歐元區的存款機制利率'))

const tableAnswer = computed(() => {
  if (!events.value.length) return null
  const regime = regimeSwitches.value.length
  const dfrFlat = dfrFlatMroMoves.value.length
  return `以下為由新到舊的每一次調整，共 ${events.value.length} 筆，${events.value[0]?.effectiveDate ?? ''} 歐元啟用至今的完整紀錄，日期為生效日。三支利率不一定同時動：有 ${dfrFlat} 次存款機制利率的幅度是 0，變的是主要再融資或邊際貸款利率。${regime ? `另有 ${regime} 筆三支都沒動，變的是主要再融資的標售機制。` : ''}`
})

const { breadcrumbs } = useHubPageSeo({
  title: '歐洲央行升降息紀錄與台股大盤',
  description: () => clampDescription(latestAnswer.value ?? '歐洲央行歷次升降息的生效日與三支政策利率，對照台灣加權股價指數的月收盤。'),
  path: '/macro/ecb-policy-rate',
  breadcrumbs: [
    { label: '首頁', to: '/' },
    { label: '總經特區', to: '/macro' },
    { label: '歐洲央行升降息', to: '/macro/ecb-policy-rate' }
  ]
})

const { resolvedMode, color } = useAppTheme()
const chartOption = computed(() => rateCycleChartOption(events.value, taiex.value, resolvedMode.value, color.value, {
  rateOf: event => event.depositFacilityRate,
  changeOf: event => event.depositFacilityChangeBp,
  rateLabel: '存款機制利率',
  seriesName: '存款機制利率',
  axisName: '利率 %',
  rateText,
  decidedLabel: '本月存款機制利率'
}))
</script>

<template>
  <div class="app-page app-page--compact macro-ecb-policy-rate-page">
    <h1 class="app-page__title macro-ecb-policy-rate-page__title">歐洲央行升降息紀錄與台股大盤</h1>
    <StockBreadcrumb :items="breadcrumbs" />
    <MacroNav />

    <section class="stock-page-section" aria-labelledby="macro-ecb-policy-rate-latest-heading">
      <h2 id="macro-ecb-policy-rate-latest-heading" class="stock-page-section__title">歐洲央行最近一次升降息是什麼時候？</h2>
      <p v-if="latestAnswer" class="hub-answer">{{ latestAnswer }}</p>
    </section>

    <section class="stock-page-section" aria-labelledby="macro-ecb-policy-rate-chart-heading">
      <h2 id="macro-ecb-policy-rate-chart-heading" class="stock-page-section__title">升降息期間台股大盤走勢如何？</h2>
      <p v-if="spanAnswer" class="hub-answer">{{ spanAnswer }}</p>
      <el-card shadow="never" class="macro-ecb-policy-rate-page__card">
        <SharedChart v-if="taiex.length > 1" class="app-chart macro-ecb-policy-rate-page__chart" :option="chartOption" autoresize />
      </el-card>
    </section>

    <section class="stock-page-section" aria-labelledby="macro-ecb-policy-rate-table-heading">
      <h2 id="macro-ecb-policy-rate-table-heading" class="stock-page-section__title">歷次升降息有哪些？</h2>
      <p v-if="tableAnswer" class="hub-answer">{{ tableAnswer }}</p>
      <SharedTableScroll label="歐洲央行政策利率歷次調整">
        <table class="seo-table" data-ssr-table>
          <caption>歐洲央行政策利率歷次調整（由新到舊，日期為生效日）</caption>
          <thead>
            <tr>
              <th scope="col">生效日</th>
              <th scope="col">存款機制利率</th>
              <th scope="col">主要再融資利率</th>
              <th scope="col">邊際貸款利率</th>
              <th scope="col">存款機制調整幅度</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="event in eventsDesc" :key="event.effectiveDate">
              <th scope="row">{{ event.effectiveDate }}</th>
              <td>{{ optionalRate(event.depositFacilityRate) }}</td>
              <td>{{ optionalRate(event.mainRefinancingRate) }}<template v-if="event.mainRefinancingIsMinimumBid">（{{ mroLabel(event) }}）</template></td>
              <td>{{ optionalRate(event.marginalLendingRate) }}</td>
              <td>{{ rateChangeText(event.depositFacilityChangeBp) }}</td>
            </tr>
          </tbody>
        </table>
      </SharedTableScroll>
      <p class="hub-answer hub-sources macro-ecb-policy-rate-page__sources">資料來源：歐洲中央銀行 Data Portal（MRR_FR、MRR_MBR、DFR、MLF 序列）、臺灣證券交易所加權股價指數。原始資料是每日的利率值；本頁的「歷次調整」是我們對每日值比對後整理出的變動事件，幅度與升降息次數由我們計算，歐洲央行本身不發布這份事件清單。</p>
    </section>
  </div>
</template>
