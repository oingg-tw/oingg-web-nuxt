<script setup lang="ts">
import type { StockMonthlyRevenuePageResponse } from '#shared/types/stock-monthly-revenue-page'
// /stock/:code/monthly-revenue — 月營收（2026-09-23,「個股瀏覽 要上月營收」）, filed under 成長動能.
//
// EXACTLY ONE CHART（2026-09-23,「monthly-revenue 維持使用一個圖表就好」）, and the two series on it
// are 月均價 and 月營收年增率 — the pair 財報狗 draws on the equivalent page, which the user pointed
// at as the thing to match.
//
// What was dropped to get to one chart is the ABSOLUTE revenue amount in 億元, and that is the
// right thing to drop rather than the price: Taiwanese monthly revenue is strongly seasonal, so a
// 電子 company's December against its February is not a comparison at all — the level is the
// series a reader can least read directly, which is the whole reason a year-on-year rate exists.
// Every month's amount is still on the page, in the table below, where a number is read rather
// than eyeballed.
//
// 月均價, not the month-end close: a month's revenue is a FLOW over the whole month, so the price
// beside it covers the whole month too（see MonthlyPrice's own comment）.
//
// Two axes because 元 and % share nothing; the legend names the unit on each series for the same
// reason 杜邦分析 does. One chart is also what this app's page shape asks for anyway — a question
// h2, an answer, one table, at most one chart（「card-per-metric = 畫面髒亂」）.
//
// SEPARATE FROM /stock/:code/revenue-growth, which is the metric page for revenueGrowthRate.Q —
// that is the same idea at QUARTERLY resolution, computed by analysis-ts from the financial
// statements. This page is the monthly filing（MOPS t187ap05_L）, which arrives on the 10th of the
// following month and is the earliest number a reader gets about a company's current trading.
const route = useRoute()
const code = computed(() => String(route.params.code))

const TOPIC = '月營收'

const { data, error, refresh } = await useFetch<StockMonthlyRevenuePageResponse>(() => `/api/stock/${code.value}/monthly-revenue`, {
  key: () => `stock-monthly-revenue-${code.value}`,
  watch: [code]
})
if (error.value) throw createError({ statusCode: 503, statusMessage: '月營收資料暫時無法取得', fatal: true })

const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite } = useStockDetailSummary(code)
const { data: filterSchema } = await useFilterSchema()
// 頁尾的資料來源（2026-10-11 補上，原本這頁沒寫）：型錄裡月營收指標的來源（證交所／櫃買中心的月營收彙總表）
const dataSources = computed(() => collectMetricSources(filterSchema.value?.categories ?? [], ['revenueYoy3m']))
// 定義與研究文獻在新手專區（2026-10-13「monthly-revenue 版面請精簡 比照別的模板」，同杜邦／現金循環）：這裡只留一句與頁尾連結
const TOPIC_GUIDE = findLearnTopic('monthly-revenue')!
const footerLinks = computed(() => [
  { to: learnTopicPath(TOPIC_GUIDE.slug), label: `${TOPIC_GUIDE.topic}怎麼看（新手專區）` },
  { to: `/stock/${code.value}/revenue-growth`, label: '營收成長年增率（季報）' }
])

// Ascending, oldest first. An EMPTY list and a FAILED read are different answers and the page says
// so differently — 興櫃 and newly-listed symbols legitimately have none（上櫃有，2026-10-11 實測）.
const ascending = computed(() => data.value?.entries ?? [])
const hasData = computed(() => ascending.value.length > 0)
const readFailed = computed(() => data.value?.entries === null)
// 讀不到時交給全站的讀取失敗彈窗（2026-10-08），畫面上不再各自出訊息
watchLoadFailure(() => `stock-monthly-revenue:${code.value}`, () => readFailed.value, refresh)

const descending = computed(() => [...ascending.value].reverse())

const latest = computed(() => descending.value[0] ?? null)

// 億元 from the filed 千元. Converted HERE and nowhere else: analysis-ts passes the unit through
// untouched by explicit agreement, so exactly one layer may do this and it has to be the one that
// also writes the label.
const THOUSAND_TO_HUNDRED_MILLION = 100_000
const toHundredMillion = (thousands: string | null): number | null => {
  // null 要先擋：Number(null) 是 0，缺值會顯示成「0.0 億元」而不是「尚無資料」（業務中台 f750e92 起營收欄位可能是 null）
  if (thousands === null) return null
  const parsed = Number(thousands)
  return Number.isFinite(parsed) ? parsed / THOUSAND_TO_HUNDRED_MILLION : null
}

// formatMoney（萬／億／兆＋4 位有效數字，2026-10-12）：原本固定 toFixed(1) 億元，月營收 300 萬的公司印成「0.0 億元」、台積電印成沒有千分位的「3000.0 億元」
const amountText = (value: number | null): string => (value === null ? '尚無資料' : formatMoney(value * THOUSAND_TO_HUNDRED_MILLION * 1000))
const rateText = (value: number | null): string => (value === null ? '尚無資料' : `${value.toFixed(2)}%`)

const latestRevenue = computed(() => (latest.value ? toHundredMillion(latest.value.currentMonthRevenue) : null))

const answer = computed(() => {
  if (!latest.value) return ''
  const parts = [
    `${stockShortName.value}（${code.value}）${latest.value.yearMonth} 月營收 ${amountText(latestRevenue.value)}`,
    `年增率 ${rateText(latest.value.yoyChangePct)}`,
    `累計營收年增率 ${rateText(latest.value.cumulativeChangePct)}`
  ]
  return `${parts.join('、')}。`
})

// The company's OWN filed explanation, shown verbatim and attributed. 「無」is a real answer — the
// company said nothing was unusual — and is kept distinct from having filed nothing at all.
const latestNote = computed(() => {
  const note = latest.value?.note
  if (!note || note === '無') return null
  return note
})

const { breadcrumbs } = useStockPageSeo({
  code,
  shortName: stockShortName,
  topic: TOPIC,
  titleKeywords: '月營收與年增率',
  pathSuffix: '/monthly-revenue',
  stock,
  summary: computed(() => null),
  description: computed(() =>
    clampDescription(
      hasData.value
        ? `${stockShortName.value}（${code.value}）近 ${ascending.value.length} 個月的月營收與年增率，含累計營收與公司自行說明的營收變動原因，資料來自公開資訊觀測站每月申報。`
        : `${stockShortName.value}（${code.value}）目前沒有月營收申報資料。`
    )
  ),
  sectorCode: computed(() => profile.value?.sectorCode ?? null)
})
</script>

<template>
  <div v-loading="stockPending" class="stock-monthly-revenue-page">
    <template v-if="stock">
      <StockSummaryCard :stock="stock" :is-emerging="profile?.isEmerging ?? null" :is-favorite="isFavorite" :short-name="stockShortName" :topic="TOPIC" @toggle-favorite="toggleFavorite" />
      <StockPageNav :code="code" />
      <StockBreadcrumb :items="breadcrumbs" />

      <StockQuestionSection id="stock-monthly-revenue" :question="`${stockShortName}（${code}）最近的月營收表現如何？`" :answer="answer">
        <el-card shadow="never" class="stock-monthly-revenue-page__card">
          <StockMonthlyRevenueChart v-if="hasData && data" :entries="ascending" :monthly-prices="data.monthlyPrices" :price-break-months="data.priceBreakMonths" />
          <!-- 讀不到：彈窗會說明並自動重讀；這裡留空，免得落到下一行「沒有申報資料」 -->
          <template v-else-if="readFailed" />
          <p v-else class="stock-monthly-revenue-page__line">
            這檔股票目前沒有月營收申報資料。興櫃公司與剛上市的公司可能還沒有紀錄。
          </p>
        </el-card>
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
        id="stock-monthly-revenue-table"
        question="逐月的數字是多少？"
        :answer="`以下為 ${stockShortName} 由新到舊的月營收，共 ${ascending.length} 個月，涵蓋 ${ascending[0]?.yearMonth} 至 ${latest?.yearMonth}。`"
      >
        <SharedTableScroll :label="`${stockShortName} ${code} 的逐月營收`">
          <table class="seo-table" data-ssr-table>
            <caption>{{ stockShortName }} {{ code }} 逐月營收（由新到舊）</caption>
            <thead>
              <tr>
                <th scope="col">月份</th>
                <th scope="col">月營收</th>
                <th scope="col">年增率（%）</th>
                <th scope="col">月增率（%）</th>
                <th scope="col">累計營收</th>
                <th scope="col">累計年增率（%）</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in descending" :key="entry.yearMonth">
                <th scope="row">{{ entry.yearMonth }}</th>
                <td>{{ amountText(toHundredMillion(entry.currentMonthRevenue)) }}</td>
                <td>{{ rateText(entry.yoyChangePct) }}</td>
                <td>{{ rateText(entry.momChangePct) }}</td>
                <td>{{ amountText(toHundredMillion(entry.cumulativeRevenue)) }}</td>
                <td>{{ rateText(entry.cumulativeChangePct) }}</td>
              </tr>
            </tbody>
          </table>
        </SharedTableScroll>
      </StockQuestionSection>
      <StockMetricGuide id-prefix="stock-monthly-revenue" :topic="TOPIC_GUIDE.topic" :definition="[TOPIC_GUIDE.summary]" />
      <StockPageFooter :sources="dataSources" :links="footerLinks" />
    </template>

    <SharedStockNotFound v-else-if="!stockPending" />
  </div>
</template>

<style scoped>
.stock-monthly-revenue-page__card {
  margin-bottom: 16px;
}

.stock-monthly-revenue-page__line {
  margin: 0;
  font-size: 1rem;
  line-height: 1.7;
}

/* The company's own words, set apart so it is visibly a quotation rather than this site's
   description of the company. */
.stock-monthly-revenue-page__note {
  margin: 0;
  padding-left: 12px;
  border-left: 3px solid var(--el-border-color);
  font-size: 1rem;
  line-height: 1.8;
  white-space: pre-wrap;
}
</style>
