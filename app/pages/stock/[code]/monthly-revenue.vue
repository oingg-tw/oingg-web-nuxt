<script setup lang="ts">
import type { LineSeriesSpec, LineChartEntry } from '~/components/stock/StockMultiSeriesLineChart.vue'
import type { StockMonthlyRevenuePageResponse } from '#shared/types/stock-monthly-revenue-page'
import { clampDescription } from '~/utils/stock-digest'

// /stock/:code/monthly-revenue — 月營收（2026-09-23,「個股瀏覽 要上月營收」）, filed under 成長動能.
//
// ONE CHART CARRYING BOTH SERIES, by direct question（「我想知道月營收與月營收成長是否該合併呈現」）.
// The answer is yes, and not for tidiness:
//
//   Taiwanese monthly revenue is strongly seasonal — a 電子 company's December is not comparable
//   to its February. The absolute series SHOWS that seasonality; the year-on-year series REMOVES
//   it. Put them on one time axis and a reader can tell「this is the slow season」from「this is a
//   real decline」, which is the entire question a monthly revenue page exists to answer. Split
//   across two charts, that comparison becomes eye-matching two x-axes.
//
// It also happens to be what this app's own page shape requires: a question h2, an answer, one
// table, at most one chart（「card-per-metric = 畫面髒亂」）.
//
// Bars for the amount, a line for the rate — see StockMultiSeriesLineChart's own `type` comment.
// Two axes because 億元 and % share nothing; the legend names the unit on each series for the same
// reason 杜邦分析 does.
//
// SEPARATE FROM /stock/:code/revenue-growth, which is the metric page for revenueGrowthRate.Q —
// that is the same idea at QUARTERLY resolution, computed by analysis-ts from the financial
// statements. This page is the monthly filing（MOPS t187ap05_L）, which arrives on the 10th of the
// following month and is the earliest number a reader gets about a company's current trading.
const route = useRoute()
const code = computed(() => String(route.params.code))

const TOPIC = '月營收'

const { data, error } = await useFetch<StockMonthlyRevenuePageResponse>(() => `/api/stock/${code.value}/monthly-revenue`, {
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

const descending = computed(() => [...ascending.value].reverse())
const latest = computed(() => descending.value[0] ?? null)

// 億元 from the filed 千元. Converted HERE and nowhere else: analysis-ts passes the unit through
// untouched by explicit agreement, so exactly one layer may do this and it has to be the one that
// also writes the label.
const THOUSAND_TO_HUNDRED_MILLION = 100_000
const toHundredMillion = (thousands: string): number | null => {
  const parsed = Number(thousands)
  return Number.isFinite(parsed) ? parsed / THOUSAND_TO_HUNDRED_MILLION : null
}

const amountText = (value: number | null): string => (value === null ? '尚無資料' : `${value.toFixed(1)} 億元`)
const rateText = (value: number | null): string => (value === null ? '尚無資料' : `${value.toFixed(2)}%`)

const REVENUE_CODE = 'revenue'
const YOY_CODE = 'yoy'

const chartEntries = computed<LineChartEntry[]>(() =>
  ascending.value.map(entry => ({
    label: entry.yearMonth,
    values: {
      [REVENUE_CODE]: { value: toHundredMillion(entry.currentMonthRevenue) },
      // null stays null — 226 rows market-wide have no year-ago month because the company listed
      // within the last year. Drawing that as 0 would invent a 100% collapse.
      [YOY_CODE]: { value: entry.yoyChangePercent }
    }
  }))
)

const SERIES = [
  { code: REVENUE_CODE, name: '月營收（億元）', lineType: 'solid', symbol: 'circle', type: 'bar', format: amountText },
  { code: YOY_CODE, name: '年增率（%）', lineType: 'solid', symbol: 'circle', axis: 'right', format: rateText }
] as const satisfies readonly LineSeriesSpec[]

const latestRevenue = computed(() => (latest.value ? toHundredMillion(latest.value.currentMonthRevenue) : null))

// 股價 × 月營收年增率（2026-09-23,「月營收年增率 跟股價放一起的 圖表 確定要做」）.
//
// Joined on the month string, and only where BOTH exist — the price series reaches further back
// than the revenue one（2021-05 vs 2021-09 on 2330）and one month further forward（the current,
// unfinished month has a price but no filed revenue yet）. An inner join rather than padding
// either side, so neither line is drawn over a period the other never covered.
const priceByMonth = computed(() => new Map((data.value?.monthEndCloses ?? []).map(point => [point.yearMonth, point.close])))
const hasPrice = computed(() => ascending.value.some(entry => priceByMonth.value.has(entry.yearMonth)))

const PRICE_CODE = 'price'
const priceText = (value: number | null): string => (value === null ? '尚無資料' : `${value.toFixed(2)} 元`)

const comparisonEntries = computed<LineChartEntry[]>(() =>
  ascending.value
    .filter(entry => priceByMonth.value.has(entry.yearMonth))
    .map(entry => ({
      label: entry.yearMonth,
      values: {
        [PRICE_CODE]: { value: priceByMonth.value.get(entry.yearMonth) ?? null },
        [YOY_CODE]: { value: entry.yoyChangePercent }
      }
    }))
)

const COMPARISON_SERIES = [
  { code: PRICE_CODE, name: '月底收盤價（元）', lineType: 'solid', symbol: 'circle', format: priceText },
  { code: YOY_CODE, name: '月營收年增率（%）', lineType: 'dashed', symbol: 'triangle', axis: 'right', format: rateText }
] as const satisfies readonly LineSeriesSpec[]

const answer = computed(() => {
  if (!latest.value) return ''
  const parts = [
    `${stockShortName.value}（${code.value}）${latest.value.yearMonth} 月營收 ${amountText(latestRevenue.value)}`,
    `年增率 ${rateText(latest.value.yoyChangePercent)}`,
    `累計營收年增率 ${rateText(latest.value.cumulativeChangePercent)}`
  ]
  return `${parts.join('、')}。月營收每月 10 日前公告，是一家公司當期營運最早出現的數字。`
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
  sectorCode: computed(() => profile.value?.industry ?? null)
})
</script>

<template>
  <div v-loading="stockPending" class="stock-monthly-revenue-page">
    <template v-if="stock">
      <StockSummaryCard :stock="stock" :is-favorite="isFavorite" :short-name="stockShortName" :topic="TOPIC" @toggle-favorite="toggleFavorite" />
      <StockPageNav :code="code" />
      <StockBreadcrumb :items="breadcrumbs" />

      <StockQuestionSection id="stock-monthly-revenue" :question="`${stockShortName}（${code}）最近的月營收表現如何？`" :answer="answer">
        <el-card shadow="never" class="stock-monthly-revenue-page__card">
          <StockMultiSeriesLineChart
            v-if="hasData"
            :entries="chartEntries"
            :series="SERIES"
            unit="億元"
            unit-right="%"
            :format="amountText"
          />
          <p v-else-if="readFailed" class="stock-monthly-revenue-page__line">
            月營收資料暫時讀不到，請稍後再看。
          </p>
          <p v-else class="stock-monthly-revenue-page__line">
            這檔股票目前沒有月營收申報資料。月營收是上市公司每月申報的項目，上櫃、興櫃或剛上市的公司可能還沒有紀錄。
          </p>
        </el-card>
      </StockQuestionSection>

      <!-- THE CITED HALF, and the wording is load-bearing（2026-09-23）.
           The research analysis-ts found is CROSS-SECTIONAL: 李顯儀等（2014）compared high-growth
           COMPANIES against low-growth COMPANIES, 2003–2012, 653→838 listed firms, pre-grouped by
           market cap and turnover. It did not test whether one company's own revenue growth moves
           its own price — which is exactly what a single stock's two lines invite a reader to
           conclude. So every sentence below has 公司 as its subject, never「這檔股票」.
           Three things deliberately absent, each because no source supports them: any lead time in
           months（the「反應速度領先」in that paper is a gap between two portfolios, not a time
           lag）, any correlation coefficient computed by us, and 顧廣平（2010）'s strategy result
           — that one is a buy-the-top-20%/sell-the-bottom-20% backtest, and quoting it on a page
           built for retail readers reads as an instruction. Its finding that the effect REVERSES
           at months 25–36 is quoted, because leaving it out would be selective citation. -->
      <StockQuestionSection
        v-if="hasData && hasPrice"
        id="stock-monthly-revenue-price"
        :question="`月營收年增率跟股價走勢對得上嗎？`"
        :answer="`以下把 ${stockShortName} 的月底收盤價與月營收年增率放在同一個時間軸上，兩條線各自標示、各用自己的刻度。本站不對這兩者的關係做任何推論，以下研究說的也不是這一檔股票。`"
      >
        <el-card shadow="never" class="stock-monthly-revenue-page__card">
          <StockMultiSeriesLineChart
            :entries="comparisonEntries"
            :series="COMPARISON_SERIES"
            unit="元"
            unit-right="%"
            :format="priceText"
          />
          <details class="stock-monthly-revenue-page__research">
            <summary>台灣實證研究怎麼說</summary>
            <p>
              台灣實證研究發現，<strong>月營收成長率較高的公司</strong>，股價報酬表現優於成長率較低的公司，在多頭市場尤其明顯（李顯儀、陳信宏、白翔文，2014，《財金論文叢刊》第 21 期，樣本為 2003 至 2012 年上市公司）。此關係在<strong>部分產業</strong>較為明顯（吳幸姬、李顯儀，2006，《管理科學研究》3 卷 2 期）。另有研究指出月營收公告具有資訊內涵，未預期的月營收與股票報酬呈正向關聯（金成隆、張耿尉，1998，《管理評論》17 卷 3 期）。
            </p>
            <p>
              這些結論都是<strong>關於公司群的比較</strong>，不是關於單一公司自己的股價會怎麼走。同一批文獻中，營收動能的效果在持有 1 至 12 個月為正，但在第 25 至 36 個月轉為負值（顧廣平，2010，《管理學報》27 卷 3 期），也沒有任何一篇提出「營收領先股價幾個月」的數字。
            </p>
          </details>
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
                <td>{{ rateText(entry.yoyChangePercent) }}</td>
                <td>{{ rateText(entry.momChangePercent) }}</td>
                <td>{{ amountText(toHundredMillion(entry.cumulativeRevenue)) }}</td>
                <td>{{ rateText(entry.cumulativeChangePercent) }}</td>
              </tr>
            </tbody>
          </table>
        </SharedTableScroll>
      </StockQuestionSection>
    </template>

    <el-result v-else-if="!stockPending" icon="warning" sub-title="請確認股票代號是否正確">
      <template #title>
        <h1 class="stock-not-found__title">找不到這檔股票</h1>
      </template>
      <template #extra>
        <el-button type="primary" @click="navigateTo('/')">回首頁</el-button>
      </template>
    </el-result>
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

/* Closed by default: the chart answers the question, and the citations are there for a reader who
   wants to know what is actually known rather than making every reader wade through it. Native <details>
   so the text is in the server HTML either way. */
.stock-monthly-revenue-page__research {
  margin-top: 12px;
  font-size: 1rem;
  line-height: 1.8;
}

.stock-monthly-revenue-page__research summary {
  cursor: pointer;
  padding: 8px 0;
  font-weight: 600;
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
