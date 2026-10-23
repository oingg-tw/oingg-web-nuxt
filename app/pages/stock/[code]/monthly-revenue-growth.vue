<script setup lang="ts">
// /stock/:code/monthly-revenue-growth — 月營收年增率（2026-10-23 從 /monthly-revenue 拆出來，使用者：「monthly-revenue 現在比較像是
// 月營收年增率 而不是月營收 希望可以拆分為兩個頁面」），歸在成長動能。金額（月營收、月增率、累計營收）在 /monthly-revenue。
//
// EXACTLY ONE CHART（2026-09-23,「monthly-revenue 維持使用一個圖表就好」），the pair 財報狗 draws: 月均價 and 月營收年增率. Since
// 2026-10-14 the 年增率 is BARS coloured by sign（漲色正、跌色負，the metric pages' own bar rule）under the 月均價 line, chosen for
// how fast a negative month reads; the chart itself lives in StockMonthlyRevenueChart (measure="yoy").
//
// Why a year-on-year rate at all: Taiwanese monthly revenue is strongly seasonal, so a 電子 company's December against its February
// is not a comparison — the rate against the same month a year earlier is the series a reader can actually compare month to month.
//
// 月均價, not the month-end close: a month's revenue is a FLOW over the whole month, so the price beside it covers the whole month
// too（see MonthlyPrice's own comment）. Two axes because 元 and % share nothing.
//
// SEPARATE FROM /stock/:code/revenue-growth, which is the metric page for revenueGrowthRate.Q — the same idea at QUARTERLY resolution,
// computed by analysis-ts from the financial statements. This page is the monthly filing（MOPS t187ap05_L）, which arrives on the 10th
// of the following month and is the earliest number a reader gets about a company's current trading.
const route = useRoute()
const code = computed(() => String(route.params.code))

const TOPIC = '月營收年增率'

const { data, ascending, descending, latest, hasData, readFailed, dataSources, pending } = await useMonthlyRevenuePage(code)
const { stock, profile, stockShortName, stockPending } = useStockDetailSummary(code)
const TOPIC_GUIDE = findLearnTopic('monthly-revenue')!
const footerLinks = computed(() => [
  { to: `/stock/${code.value}/monthly-revenue`, label: '月營收' },
  { to: learnTopicPath(TOPIC_GUIDE.slug), label: `${TOPIC_GUIDE.topic}怎麼看（新手專區）` },
  { to: `/stock/${code.value}/revenue-growth`, label: '營收成長年增率（季報）' }
])

const tableText = computed(() => historyTableText({ shortName: stockShortName.value, code: code.value, topic: '月營收年增率', count: ascending.value.length, countUnit: '個月', from: ascending.value[0]?.yearMonth ?? '', to: latest.value?.yearMonth ?? '' }))

const answer = computed(() => {
  const entry = latest.value
  if (!entry) return ''
  return `${stockShortName.value}（${code.value}）${entry.yearMonth} 月營收年增率 ${monthlyRevenueRateText(entry.yoyChangePct)}、今年累計營收年增率 ${monthlyRevenueRateText(entry.cumulativeChangePct)}。`
})

// The company's OWN filed explanation, shown verbatim and attributed. 「無」is a real answer — the company said nothing was unusual —
// and is kept distinct from having filed nothing at all. 變動原因說的是比去年同期多或少，所以在年增率這一頁
const latestNote = computed(() => {
  const note = latest.value?.note
  if (!note || note === '無') return null
  return note
})

const { breadcrumbs } = useStockPageSeo({
  code,
  shortName: stockShortName,
  topic: TOPIC,
  titleKeywords: '月營收年增率',
  pathSuffix: '/monthly-revenue-growth',
  stock,
  description: computed(() =>
    clampDescription(
      hasData.value
        ? `${stockShortName.value}（${code.value}）近 ${ascending.value.length} 個月的月營收年增率與今年累計營收年增率，含公司自行說明的營收變動原因，資料來自公開資訊觀測站每月申報。`
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
      id="stock-monthly-revenue-growth"
      :question="`${stockShortName}（${code}）的月營收比去年同月多還是少？`"
      :answer="answer"
      :answer-skeleton="pending ? `${stockShortName}（${code}）2026-09 月營收年增率 00.00%、今年累計營收年增率 00.00%。` : null"
    >
      <StockMonthlyRevenueChart v-if="hasData && data" measure="yoy" :entries="ascending" :monthly-prices="data.monthlyPrices" :price-break-months="data.priceBreakMonths" />
      <SharedChartCard v-else-if="pending"><div class="app-skeleton app-skeleton--chart" aria-hidden="true" /></SharedChartCard>
      <!-- 讀不到：彈窗會說明並自動重讀；這裡留空，免得落到下一行「沒有申報資料」 -->
      <template v-else-if="readFailed" />
      <p v-else class="stock-monthly-revenue-page__line">
        這檔股票目前沒有月營收申報資料。興櫃公司與剛上市的公司可能還沒有紀錄。
      </p>
    </StockQuestionSection>

    <StockQuestionSection
      v-if="latestNote"
      id="stock-monthly-revenue-note"
      :question="`${stockShortName}自己怎麼說明營收變動？`"
      :answer="`以下是 ${stockShortName} 在 ${latest?.yearMonth} 月營收申報中自行填寫的變動原因，原文照錄。`"
    >
      <el-card shadow="never" class="stock-monthly-revenue-page__card">
        <blockquote class="stock-monthly-revenue-page__note">{{ latestNote }}</blockquote>
      </el-card>
    </StockQuestionSection>

    <StockQuestionSection
      v-if="hasData"
      id="stock-monthly-revenue-growth-table"
      :question="tableText.question"
      :answer="tableText.answer"
    >
      <SharedTable :label="tableText.label">
        <thead>
          <tr>
            <th scope="col">月份</th>
            <th scope="col" class="seo-table__num">年增率（%）</th>
            <th scope="col" class="seo-table__num">今年累計年增率（%）</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in descending" :key="entry.yearMonth">
            <th scope="row">{{ entry.yearMonth }}</th>
            <td class="seo-table__num">{{ monthlyRevenueRateText(entry.yoyChangePct) }}</td>
            <td class="seo-table__num">{{ monthlyRevenueRateText(entry.cumulativeChangePct) }}</td>
          </tr>
        </tbody>
      </SharedTable>
    </StockQuestionSection>
    <template #guide>
      <StockMetricGuide id-prefix="stock-monthly-revenue-growth" :topic="TOPIC_GUIDE.topic" :definition="[TOPIC_GUIDE.summary]" />
    </template>
  </StockPageShell>
</template>

<style scoped>
.stock-monthly-revenue-page__line {
  margin: 0;
  font-size: 1rem;
  line-height: 1.7;
}

/* The company's own words, set apart so it is visibly a quotation rather than this site's description of the company. */
.stock-monthly-revenue-page__note {
  margin: 0;
  padding-left: 12px;
  border-left: 3px solid var(--el-border-color);
  font-size: 1rem;
  line-height: 1.8;
  white-space: pre-wrap;
}
</style>
