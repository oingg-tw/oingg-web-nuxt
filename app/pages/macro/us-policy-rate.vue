<script setup lang="ts">
import type { RateCyclePageData, UsRateCycleEvent } from '#shared/types/hub'
// /macro/us-policy-rate — 聯準會升降息紀錄（2026-09-29）。之前沒有這一頁不是上游壞了（兩則「404／502」的筆記實打都不成立），
// 是路由從來沒建過。自己一頁而不是併進央行那頁（使用者決定）：兩份資料的欄位形狀真的不同——台灣是三個具名利率，美國是一個
// 目標區間的上下限——而「台美利差」是一個判讀主張，要先有人決定要主張什麼。
// 不做任何因果宣稱，這一頁比央行那頁更需要：圖上的指數是台灣的、利率是美國的，放在同一個時間軸上很容易被讀成因果。
// 圖的做法在 rateCycleChartOption，三個利率頁共用。

const { data, error } = await useFetch<RateCyclePageData<UsRateCycleEvent>>('/api/hub/macro-us-policy-rate', { key: 'hub-macro-us-policy-rate' })
if (error.value || !data.value) throw createError({ statusCode: 503, statusMessage: '聯準會利率資料暫時無法取得', fatal: true })

const events = computed(() => data.value?.events ?? [])
const eventsDesc = computed(() => [...events.value].reverse())
const taiex = computed(() => data.value?.taiex ?? [])
const latest = computed(() => eventsDesc.value[0] ?? null)

const rateText = (value: number): string => `${value.toFixed(2)}%`
// 2008-12-16 起 FOMC 設的是一個區間，在那之前是單一目標（實測：153 筆單一、33 筆區間）。上下限相等的印成「4.75%–4.75%」
// 會讓讀者以為資料有問題，而那個區間在當年並不存在。
function targetText(event: { targetUpper: number; targetLower: number }): string {
  return event.targetUpper === event.targetLower
    ? rateText(event.targetUpper)
    : `${rateText(event.targetLower)}–${rateText(event.targetUpper)}`
}

const hikes = computed(() => events.value.filter(event => (event.changeBp ?? 0) > 0).length)
const cuts = computed(() => events.value.filter(event => (event.changeBp ?? 0) < 0).length)

const latestAnswer = computed(() => {
  const event = latest.value
  if (!event) return null
  return `聯準會最近一次調整政策利率是 ${event.effectiveDate} 生效，聯邦資金利率目標 ${targetText(event)}，${rateChangeText(event.changeBp)}。自 ${events.value[0]?.effectiveDate ?? ''} 起共 ${events.value.length} 次調整，其中升息 ${hikes.value} 次、降息 ${cuts.value} 次。`
})

const spanAnswer = computed(() => rateCycleSpanAnswer(taiex.value, events.value, '美國的聯邦資金利率目標上限'))

// 兩件事讀者不講就會誤會，而且都是資料本身的性質不是評論：只收有變動的決議（上游是對每日持平值做 diff，維持不變的會議
// 根本不在資料裡，gov-ts 也沒有會議日期），以及最早一筆只是序列的起點。
const tableAnswer = computed(() => {
  if (!events.value.length) return null
  return `以下為由新到舊的每一次調整，共 ${events.value.length} 筆，${events.value[0]?.effectiveDate ?? ''} 至今，日期為生效日。這是升降息的紀錄，不是每一次會議的紀錄——維持不變的決議不會出現在這裡。最早的一筆是這份序列的起點，不是聯準會開始設定利率的起點。`
})

const { breadcrumbs } = useHubPageSeo({
  title: '美國聯準會升降息紀錄與台股大盤',
  description: () => clampDescription(latestAnswer.value ?? '美國聯準會歷次升降息的生效日與聯邦資金利率目標區間，對照台灣加權股價指數的月收盤。'),
  path: '/macro/us-policy-rate',
  breadcrumbs: [
    { label: '首頁', to: '/' },
    { label: '總經特區', to: '/macro' },
    { label: '聯準會升降息', to: '/macro/us-policy-rate' }
  ]
})

// 畫在上限而不是中值：新聞與 FOMC 聲明講的都是區間，上限是 2008 年前後都存在的那一個（之前上下限相等，畫哪個都一樣）
const { resolvedMode, color } = useAppTheme()
const chartOption = computed(() => rateCycleChartOption(events.value, taiex.value, resolvedMode.value, color.value, {
  rateOf: event => event.targetUpper,
  changeOf: event => event.changeBp,
  rateLabel: '聯邦資金利率上限',
  seriesName: '聯邦資金利率目標上限',
  axisName: '利率上限 %',
  rateText
}))
</script>

<template>
  <div class="app-page app-page--compact macro-us-policy-rate-page">
    <h1 class="app-page__title macro-us-policy-rate-page__title">美國聯準會升降息紀錄與台股大盤</h1>
    <StockBreadcrumb :items="breadcrumbs" />
    <MacroNav />

    <section class="stock-page-section" aria-labelledby="macro-us-policy-rate-latest-heading">
      <h2 id="macro-us-policy-rate-latest-heading" class="stock-page-section__title">聯準會最近一次升降息是什麼時候？</h2>
      <p v-if="latestAnswer" class="hub-answer">{{ latestAnswer }}</p>
    </section>

    <section class="stock-page-section" aria-labelledby="macro-us-policy-rate-chart-heading">
      <h2 id="macro-us-policy-rate-chart-heading" class="stock-page-section__title">升降息期間台股大盤走勢如何？</h2>
      <p v-if="spanAnswer" class="hub-answer">{{ spanAnswer }}</p>
      <el-card shadow="never" class="macro-us-policy-rate-page__card">
        <SharedChart v-if="taiex.length > 1" class="app-chart macro-us-policy-rate-page__chart" :option="chartOption" autoresize />
      </el-card>
    </section>

    <section class="stock-page-section" aria-labelledby="macro-us-policy-rate-table-heading">
      <h2 id="macro-us-policy-rate-table-heading" class="stock-page-section__title">歷次升降息有哪些？</h2>
      <p v-if="tableAnswer" class="hub-answer">{{ tableAnswer }}</p>
      <SharedTableScroll label="美國聯邦資金利率歷次調整">
        <table class="seo-table" data-ssr-table>
          <caption>美國聯邦資金利率歷次調整（由新到舊，日期為生效日）</caption>
          <thead>
            <tr>
              <th scope="col">生效日</th>
              <th scope="col">目標區間</th>
              <th scope="col">調整幅度</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="event in eventsDesc" :key="event.effectiveDate">
              <th scope="row">{{ event.effectiveDate }}</th>
              <td>{{ targetText(event) }}</td>
              <td>{{ rateChangeText(event.changeBp) }}</td>
            </tr>
          </tbody>
        </table>
      </SharedTableScroll>
      <p class="hub-answer hub-sources macro-us-policy-rate-page__sources">資料來源：美國聯邦準備理事會（經 FRED 的 DFEDTAR、DFEDTARU、DFEDTARL 序列）、臺灣證券交易所加權股價指數。</p>
    </section>
  </div>
</template>
