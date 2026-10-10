<script setup lang="ts">
import type { LineSeriesSpec, LineChartEntry } from '~/components/stock/StockMultiSeriesLineChart.vue'
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

// Ascending, oldest first. An EMPTY list and a FAILED read are different answers and the page says
// so differently — 月營收 is a 上市 filing, so a TPEx or newly-listed symbol legitimately has none.
const ascending = computed(() => data.value?.entries ?? [])
const hasData = computed(() => ascending.value.length > 0)
const readFailed = computed(() => data.value?.entries === null)
// 讀不到時交給全站的讀取失敗彈窗（2026-10-08），畫面上不再各自出訊息
watchLoadFailure(() => `stock-monthly-revenue:${code.value}`, () => readFailed.value, refresh)

const descending = computed(() => [...ascending.value].reverse())

// 區間選單（2026-09-30「補區間選單」）。**perYear 傳 12**：這一頁是月頻率，近5年是 60 個月不是
// 20 個月——helper 的預設 4 是給季頻率用的。視窗狀態沿用指標頁那一份跨頁共用的偏好。
// 只切圖，不切下面的表格。
const lookbackWindow = useMetricHistoryChartWindow()
const MONTHS_PER_YEAR = 12
const insufficientYears = computed(() => insufficientLookbackYears(ascending.value.length, MONTHS_PER_YEAR))
const fittedWindow = computed(() => fitLookbackWindow(lookbackWindow.value, ascending.value.length, MONTHS_PER_YEAR))

const latest = computed(() => descending.value[0] ?? null)

// 億元 from the filed 千元. Converted HERE and nowhere else: analysis-ts passes the unit through
// untouched by explicit agreement, so exactly one layer may do this and it has to be the one that
// also writes the label.
const THOUSAND_TO_HUNDRED_MILLION = 100_000
const toHundredMillion = (thousands: string | null): number | null => {
  // null 要先擋：Number(null) 是 0，缺值會顯示成「0.0 億元」而不是「尚無資料」（bff-ts f750e92 起營收欄位可能是 null）
  if (thousands === null) return null
  const parsed = Number(thousands)
  return Number.isFinite(parsed) ? parsed / THOUSAND_TO_HUNDRED_MILLION : null
}

const amountText = (value: number | null): string => (value === null ? '尚無資料' : `${value.toFixed(1)} 億元`)
const rateText = (value: number | null): string => (value === null ? '尚無資料' : `${value.toFixed(2)}%`)

const YOY_CODE = 'yoy'
const PRICE_CODE = 'price'

const priceText = (value: number | null): string => (value === null ? '尚無資料' : `${value.toFixed(2)} 元`)

// Joined on the month string. The x-axis is driven by the REVENUE months, not the price ones: the
// price series starts earlier（2021-05 vs 2021-09 on 2330）and runs one month further forward, and
// neither of those stretches answers this page's question. A month with no price is left null
// rather than padded, so `connectNulls: false` leaves a real gap instead of a straight segment.
const priceByMonth = computed(() => new Map((data.value?.monthlyPrices ?? []).map(point => [point.yearMonth, point.avgClose])))
const windowedChartEntries = computed(() => sliceToLookbackWindow(chartEntries.value, fittedWindow.value, MONTHS_PER_YEAR))

const hasPrice = computed(() => ascending.value.some(entry => priceByMonth.value.has(entry.yearMonth)))

const chartEntries = computed<LineChartEntry[]>(() =>
  ascending.value.map(entry => ({
    label: entry.yearMonth,
    values: {
      [PRICE_CODE]: { value: priceByMonth.value.get(entry.yearMonth) ?? null },
      // null stays null — 226 rows market-wide have no year-ago month because the company listed
      // within the last year. Drawing that as 0 would invent a 100% collapse.
      [YOY_CODE]: { value: entry.yoyChangePct }
    }
  }))
)

// The price series drops out entirely when the price read failed, rather than the chart doing so:
// the year-on-year line is this page's own subject and stands on its own. It then takes the LEFT
// axis, so a single-series chart has no empty second scale hanging off it.
// The unit is NOT repeated in these names, unlike 杜邦分析's four. Measured at 375px: with「（元）」
// and「（%）」appended the two names wrap to a second legend row, and that row lands on top of the
// left axis's own「元」label. Both units are already on the chart as axis names, and the tooltip
// prints each value with its unit, so the legend was the third copy — the one that did not fit.
const chartSeries = computed<LineSeriesSpec[]>(() =>
  hasPrice.value
    ? [
        { code: PRICE_CODE, name: '月均價', lineType: 'solid', symbol: 'circle', format: priceText },
        { code: YOY_CODE, name: '月營收年增率', lineType: 'dashed', symbol: 'triangle', axis: 'right', format: rateText, negativeBand: true, baseline: true }
      ]
    : [{ code: YOY_CODE, name: '月營收年增率', lineType: 'solid', symbol: 'triangle', format: rateText, negativeBand: true, baseline: true }]
)

const latestRevenue = computed(() => (latest.value ? toHundredMillion(latest.value.currentMonthRevenue) : null))

const answer = computed(() => {
  if (!latest.value) return ''
  const parts = [
    `${stockShortName.value}（${code.value}）${latest.value.yearMonth} 月營收 ${amountText(latestRevenue.value)}`,
    `年增率 ${rateText(latest.value.yoyChangePct)}`,
    `累計營收年增率 ${rateText(latest.value.cumulativeChangePct)}`
  ]
  return `${parts.join('、')}。月營收每月 10 日前公告，是一家公司當期營運最早出現的數字，比季報早兩到四個月。台灣是少數強制上市公司按月申報營收的市場，下一節的研究都建立在這項制度上。`
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
          <div v-if="hasData" class="stock-page-window">
            <SharedLookbackWindowSelect
              :model-value="fittedWindow ?? lookbackWindow"
              :insufficient-years="insufficientYears"
              @update:model-value="value => (lookbackWindow = value)"
            />
          </div>
          <StockMultiSeriesLineChart
            v-if="hasData"
            :entries="windowedChartEntries"
            :series="chartSeries"
            palette="accent"
            :unit="hasPrice ? '元' : '%'"
            :unit-right="hasPrice ? '%' : undefined"
            :format="hasPrice ? priceText : rateText"
          />
          <!-- 讀不到：彈窗會說明並自動重讀；這裡留空，免得落到下一行「沒有申報資料」 -->
          <template v-else-if="readFailed" />
          <p v-else class="stock-monthly-revenue-page__line">
            這檔股票目前沒有月營收申報資料。月營收是上市公司每月申報的項目，上櫃、興櫃或剛上市的公司可能還沒有紀錄。
          </p>
        </el-card>
      </StockQuestionSection>

      <!-- THE CITED HALF, and the wording is load-bearing.
           Rewritten 2026-09-23 on a direct instruction —「這頁少解釋自己，與其要解釋自己 不如找找
           月營收與股價的相關性研究與論文」. What it replaced was three sentences describing this
           page's own chart（which axis, which colour, what the shading means）; a reader can see
           all of that, and none of it is knowledge.
           EVERY ONE of these studies is CROSS-SECTIONAL — it compares COMPANIES against other
           COMPANIES, or portfolios against portfolios. None of them tests whether one company's
           own revenue growth moves its own price, which is exactly what two lines on one time
           axis invite a reader to conclude. So every sentence below has 公司 or 公司群 as its
           subject, never「這檔股票」, and the last paragraph says so outright rather than leaving
           it implied.
           Three things stay deliberately absent because no source supports them: a lead time in
           months（the「領先」in this literature is a gap between portfolios or a pre-earnings
           window, never a stated lag）, any correlation coefficient computed by us, and the
           long/short portfolio returns the momentum papers report — quoting a
           buy-the-top-decile/sell-the-bottom result on a page built for retail readers reads as
           an instruction, whatever frame it is put in. What IS quoted from those papers is the
           market-behaviour finding and the CONDITION it depends on.
           Nothing here is collapsed. The limits in the last paragraph qualify the findings above
           them, and hiding them behind a summary while the positive findings stay open would be
           selective citation by layout. -->
      <StockQuestionSection
        v-if="hasData"
        id="stock-monthly-revenue-research"
        question="月營收年增率跟股價走勢對得上嗎？"
        answer="這個問題有實證研究可以引用，但研究回答的是「公司群之間」的比較，不是任何一家公司自己的股價會怎麼走。台灣強制上市公司按月申報營收，是少數能直接檢驗這件事的市場，因此相關文獻不少。"
      >
        <el-card shadow="never" class="stock-monthly-revenue-page__card">
          <div class="stock-monthly-revenue-page__research">
            <h3>月營收帶有新的資訊</h3>
            <p>
              以台灣的月營收申報為樣本，月營收的<strong>意外值</strong>會顯著影響分析師的盈餘預測，並且能預測後續的盈餘意外，其預測力超出分析師預測本身已含的資訊。同一研究也觀察到，股價在<strong>季報公布前</strong>會隨月營收意外同向漂移，但等季報真正公布後，股價就不再由月營收意外驅動（Chen &amp; Yu, 2022,《Review of Quantitative Finance and Accounting》58 卷 1 期，頁 245–295）。更早的台灣研究也指出月營收公告具有資訊內涵，未預期的月營收與股票報酬呈正向關聯（金成隆、張耿尉，1998，《管理評論》17 卷 3 期）。
            </p>

            <h3>年增率較高的公司，報酬表現與較低者有差異</h3>
            <p>
              同樣取自台灣月營收報告的年增率，研究發現股價會<strong>獨立於季度營收公告</strong>吸收月營收資訊，而這個差異主要出現在營收成長<strong>本身具有持續性</strong>的情況下（Hung, Lu &amp; Yang, 2025,《Review of Quantitative Finance and Accounting》）。在 2003 至 2012 年的上市公司樣本中，月營收成長率較高的公司，股價報酬表現優於成長率較低的公司，多頭市場尤其明顯（李顯儀、陳信宏、白翔文，2014,《財金論文叢刊》第 21 期）。
            </p>

            <h3>不是台灣獨有的現象</h3>
            <p>
              以美國市場為樣本，營收意外對股價報酬具有<strong>超出盈餘意外的額外解釋力</strong>：盈餘公告日的股價反應同時與當期及過去的營收意外顯著相關（Jegadeesh &amp; Livnat, 2006,《Journal of Accounting and Economics》41 卷，頁 147–171）。
            </p>

            <h3>這些研究說不到的地方</h3>
            <p>
              效果在<strong>部分產業</strong>較為明顯，並非全市場一致（吳幸姬、李顯儀，2006,《管理科學研究》3 卷 2 期）。營收動能的效果在持有 1 至 12 個月為正，但在第 25 至 36 個月<strong>轉為負值</strong>（顧廣平，2010,《管理學報》27 卷 3 期）。
            </p>
            <p>
              最重要的一點：以上每一項衡量的都是<strong>把公司分組之後的組間差異</strong>。沒有任何一篇說某一檔股票的股價會跟著它自己的月營收走，也沒有任何一篇提出「營收領先股價幾個月」的數字。本站不對上圖兩條線的關係做任何推論。
            </p>
          </div>
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
                <th scope="col">月營收（億元）</th>
                <th scope="col">年增率（%）</th>
                <th scope="col">月增率（%）</th>
                <th scope="col">累計營收（億元）</th>
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

/* Open prose, not a disclosure. It was a closed <details> under the chart until 2026-09-23, when
   the page was told to carry research instead of describing itself — at which point the citations
   became the section's content rather than an aside from it. */
.stock-monthly-revenue-page__research {
  font-size: 1rem;
  line-height: 1.8;
}

/* h3 because the section's own question is the h2 — the heading order has to stay unbroken for a
   screen reader walking the page by heading. */
.stock-monthly-revenue-page__research h3 {
  margin: 20px 0 8px;
  font-size: 1.0625rem;
  font-weight: 600;
}

.stock-monthly-revenue-page__research h3:first-child {
  margin-top: 0;
}

.stock-monthly-revenue-page__research p {
  margin: 0 0 12px;
  color: var(--el-text-color-regular);
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
