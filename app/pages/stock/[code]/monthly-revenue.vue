<script setup lang="ts">
// /stock/:code/monthly-revenue — 月營收（2026-09-23,「個股瀏覽 要上月營收」）, filed under 成長動能.
//
// 2026-10-23 拆成兩頁（使用者：「monthly-revenue 現在比較像是 月營收年增率 而不是月營收 希望可以拆分為兩個頁面」）。這一頁回答
// 「一個月賣多少」：圖是月營收金額（柱）配月均價（線），表是月營收、月增率與累計營收。年增率、累計年增率與公司自己寫的營收變動原因
// 在 /monthly-revenue-growth——台灣的月營收季節性強（電子業的 12 月跟 2 月不能直接比），「比去年同月多多少」是那一頁的事。
// 資料、格式與讀取失敗的處理兩頁共用（useMonthlyRevenuePage）。
const route = useRoute()
const code = computed(() => String(route.params.code))

const TOPIC = '月營收'

const { data, ascending, descending, latest, hasData, readFailed, dataSources, pending } = await useMonthlyRevenuePage(code)
const { stock, profile, stockShortName, stockPending } = useStockDetailSummary(code)
// 定義與研究文獻在新手專區（2026-10-13「monthly-revenue 版面請精簡 比照別的模板」，同杜邦／現金循環）：這裡只留一句與頁尾連結
const TOPIC_GUIDE = findLearnTopic('monthly-revenue')!
const footerLinks = computed(() => [
  { to: `/stock/${code.value}/monthly-revenue-growth`, label: '月營收年增率' },
  { to: learnTopicPath(TOPIC_GUIDE.slug), label: `${TOPIC_GUIDE.topic}怎麼看（新手專區）` },
  { to: `/stock/${code.value}/revenue-growth`, label: '營收成長年增率（季報）' }
])

const amount = (thousands: string | null) => monthlyRevenueAmountText(monthlyRevenueHundredMillion(thousands))
const tableText = computed(() => historyTableText({ shortName: stockShortName.value, code: code.value, topic: '月營收', count: ascending.value.length, countUnit: '個月', from: ascending.value[0]?.yearMonth ?? '', to: latest.value?.yearMonth ?? '' }))

// 最近一個月賣多少、今年到這個月累計多少；年增率在另一頁，這裡不寫
const answer = computed(() => {
  const entry = latest.value
  if (!entry) return ''
  const month = Number(entry.yearMonth.slice(5))
  return `${stockShortName.value}（${code.value}）${entry.yearMonth} 月營收 ${amount(entry.currentMonthRevenue)}，今年${month > 1 ? ` 1～${month} 月` : ' 1 月'}累計 ${amount(entry.cumulativeRevenue)}。`
})

const { breadcrumbs } = useStockPageSeo({
  code,
  shortName: stockShortName,
  topic: TOPIC,
  titleKeywords: '月營收',
  pathSuffix: '/monthly-revenue',
  stock,
  description: computed(() =>
    clampDescription(
      hasData.value
        ? `${stockShortName.value}（${code.value}）近 ${ascending.value.length} 個月的月營收、月增率與今年累計營收，配月均價對照，資料來自公開資訊觀測站每月申報。`
        : `${stockShortName.value}（${code.value}）目前沒有月營收申報資料。`
    )
  ),
  sectorCode: computed(() => profile.value?.sectorCode ?? null)
})
</script>

<template>
  <StockPageShell
    class="stock-monthly-revenue-page"
    :code="code"
    :stock="stock"
    :pending="stockPending"
    :is-emerging="profile?.isEmerging ?? null"
    :short-name="stockShortName"
    :topic="TOPIC"
    :breadcrumbs="breadcrumbs"
    :footer="{ sources: dataSources, links: footerLinks }"
  >
    <StockQuestionSection
      id="stock-monthly-revenue"
      :question="`${stockShortName}（${code}）每個月的營收是多少？`"
      :answer="answer"
      :answer-skeleton="pending ? `${stockShortName}（${code}）2026 年 9 月營收 0,000 億元，比去年同月多 00.00%、今年累計 0,000 億元。` : null"
    >
      <StockMonthlyRevenueChart v-if="hasData && data" measure="amount" :entries="ascending" :monthly-prices="data.monthlyPrices" :price-break-months="data.priceBreakMonths" />
      <SharedChartCard v-else-if="pending"><div class="app-skeleton app-skeleton--chart" aria-hidden="true" /></SharedChartCard>
      <!-- 讀不到：彈窗會說明並自動重讀；這裡留空，免得落到下一行「沒有申報資料」 -->
      <template v-else-if="readFailed" />
      <p v-else class="stock-monthly-revenue-page__line">
        這檔股票目前沒有月營收申報資料。興櫃公司與剛上市的公司可能還沒有紀錄。
      </p>
    </StockQuestionSection>

    <StockQuestionSection
      v-if="hasData"
      id="stock-monthly-revenue-table"
      :question="tableText.question"
      :answer="tableText.answer"
    >
      <SharedTable :label="tableText.label">
        <thead>
          <tr>
            <th scope="col">月份</th>
            <th scope="col" class="seo-table__num">月營收</th>
            <th scope="col" class="seo-table__num">月增率（%）</th>
            <th scope="col" class="seo-table__num">今年累計營收</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in descending" :key="entry.yearMonth">
            <th scope="row">{{ entry.yearMonth }}</th>
            <td class="seo-table__num">{{ amount(entry.currentMonthRevenue) }}</td>
            <td class="seo-table__num">{{ monthlyRevenueRateText(entry.momChangePct) }}</td>
            <td class="seo-table__num">{{ amount(entry.cumulativeRevenue) }}</td>
          </tr>
        </tbody>
      </SharedTable>
    </StockQuestionSection>
    <template #guide>
      <StockMetricGuide id-prefix="stock-monthly-revenue" :topic="TOPIC_GUIDE.topic" :definition="[TOPIC_GUIDE.summary]" />
    </template>
  </StockPageShell>
</template>

<style scoped>
.stock-monthly-revenue-page__line {
  margin: 0;
  font-size: 1rem;
  line-height: 1.7;
}
</style>
