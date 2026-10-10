<script setup lang="ts">
import type { MetricCatalog } from '~/composables/screener/useFilterSchema'
import type { SeriesTableColumn } from '~/utils/stock-series-table'
// 配股配息（路由 2026-09-17）。2026-09-19 依「畫面髒亂」改成文件式：問句區段、短答句、一張表。四段——殖利率是多少（答句＋
// 市場百分位量表）、近幾季的配息數字怎麼變化、歷年配了多少股利、下次除權息是什麼時候。資料全部在 SSR HTML 裡，來自
// /api/stock/:code/series?page=dividend（useStockPageDigest）。
// 2026-09-24 移出兩段：填息搬到 /stock/:code/dividend-fill（同一份 payload，填息仍在這裡的伺服器端算，只有渲染搬走）；
// 「股息從哪裡來」整段刪除（「這個區塊整個刪掉」，連同它唯一的卡片元件）。
const route = useRoute()
const code = computed(() => String(route.params.code))

const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite, summary } = useStockDetailSummary(code)

// Always the route's own code — the earlier `stock.value ? [code] : []` was `[]` during SSR (the
// summary hadn't resolved when this ran), so the notices were never server-fetched and the
// ex-date clause appeared only after hydration (found 2026-09-19).
const { data: exDividendNotices } = useExDividendNotices(computed(() => [code.value]))

// Catalog awaited once before any card mounts (feedback_useasyncdata_shared_key_race memory).
await useFilterSchema()
const { data: filterSchema } = useNuxtData<MetricCatalog>('filter-schema')

const { digest, description, series } = await useStockPageDigest(code, 'dividend', { shortName: stockShortName, exDividendNotices })

const sectorCode = computed(() => profile.value?.industry ?? null)
const { breadcrumbs } = useStockPageSeo({ code, shortName: stockShortName, topic: '配股配息', titleKeywords: '股利、殖利率與配息紀錄', pathSuffix: '/dividend', stock, summary, description, sectorCode })

const groups = computed(() => series.value?.groups ?? {})
const history = computed(() => series.value?.dividendHistory?.entries ?? [])
const yieldRank = computed(() => series.value?.ranks?.find(item => item.field === 'dividendYield.EOD')?.rank ?? null)
// Counted server-side over payers only — NOT `yieldRank`, whose population still contains the 278
// companies that pay nothing（GET /screener/company-rank ignores excludeZero; see PayerPercentile）.
// The gauge and the answer sentence both read this one, so they can no longer disagree.
const payerPercentile = computed(() => series.value?.payerPercentile ?? null)

// Column labels/units come from the metric catalog（same names the cards and the digest use）.
//
// 六欄砍成三欄（2026-09-28「dividend 這一頁表格的資訊太多，請刪減」）。留下的三支**就是這一段的答句
// 自己引用的那三支**（seriesAnswer 的 rangeClause：每股股利、盈餘發放率、現金流量股利保障倍數），
// 所以答句與表格從此講同一件事，不必另外訂一套取捨規則。
//
// 砍掉的三支各自都有專頁：股東總回饋率 /shareholder-yield、每股自由現金流 /fcf-per-share、每股營業
// 現金流 /ocf-per-share。這一頁 2026-09-21 就用同一個理由把它們從答句裡拿掉了（「dividend 就讓它是
// 現金殖利率就好」），當時把表格留著並說那是它們「真正的家」——不是，那三支的家是自己的頁面，留在這裡
// 只是讓 23 × 7 的表格在手機上橫著捲。
const seriesColumns = computed<SeriesTableColumn[]>(() =>
  ['dividendPerShare', 'dividendPayoutRatio', 'dividendCoverageRatio'].map(metricCode => catalogColumn(filterSchema.value?.categories ?? [], metricCode, 'TTM_DIV_40', 'TTM'))
)

// ① 殖利率是多少？— scoped down to just the cash yield itself (2026-09-21, direct request
// 「stock/2330/dividend 不要有總覽概念，這樣資訊會太多。dividend 就讓它是現金殖利率就好。總回饋律那邊
// 才把股票股利與買回等等加總看」). Used to also state dividendPerShare/dividendPayoutRatio/
// shareholderYield/consecutiveDividendYears via factTexts() — dropped, not trimmed for length:
// those four are a different question (how much did the company pay in total, from which
// mechanisms) than this one (what's the cash yield), and shareholderYield in particular now has
// its own dedicated page (/stock/:code/shareholder-yield, 2026-09-21) that IS the "add cash
// dividends + buybacks together" view — restating it here would be the same kind of duplication
// already removed from the badge/metric 目前值 cards. 2026-09-28 the same reasoning reached ②'s
// own table: it kept all six columns, and three of them（股東總回饋率／每股自由現金流／每股營業現金流）
// now have their own pages — see seriesColumns below.
const overviewAnswer = computed(() => {
  const valuation = summary.value?.valuation
  const stats = payerPercentile.value
  // Built from `payerPercentile`, not from rankSentence(yieldRank) as it was until 2026-09-24.
  // That sentence read GET /screener/company-rank and labelled its population「有配息公司中」on the
  // strength of the excludeZero flag — which that endpoint ignores, so it was naming a population
  // of 1,723 that still included 278 companies paying nothing. It also disagreed with the gauge
  // directly below it（PR27 against PR13）. Both now read the same server-side count.
  if (stats) {
    return `殖利率 ${stats.value.toFixed(2)}%：有配息的 ${stats.total.toLocaleString('en-US')} 家公司中，第 ${Math.round(stats.percentile)} 百分位${valuation?.tradeDate ? `（${valuation.tradeDate}）` : ''}。`
  }
  if (valuation?.dividendYield === 0) return `最近一年度${NO_DIVIDEND_TEXT}（${valuation.tradeDate}）。`
  return valuation?.dividendYield !== null && valuation?.dividendYield !== undefined
    ? `殖利率 ${valuation.dividendYield.toFixed(2)}%（${valuation.tradeDate}）。`
    : null
})

// ② how the numbers moved over the quarters bff-ts has（first and last non-null points）.
function rangeClause(metricCode: string, label: string, unit: string): string | null {
  const entries = groups.value.TTM_DIV_40?.entries ?? []
  const points = entries.map(entry => ({ entry, point: entry.values[metricCode] })).filter(item => item.point && item.point.value !== null)
  if (points.length < 2) return null
  const first = points[0]!
  const last = points[points.length - 1]!
  return `${label}由 ${periodLabel(first.entry, 'Q')} 的 ${formatSeriesNumber(first.point!.value!)}${unit} 到 ${periodLabel(last.entry, 'Q')} 的 ${formatSeriesNumber(last.point!.value!)}${unit}`
}

const seriesAnswer = computed(() => {
  const count = groups.value.TTM_DIV_40?.entries.length ?? 0
  if (!count) return null
  const clauses = joinClauses([rangeClause('dividendPerShare', '近四季每股股利', ' 元'), rangeClause('dividendPayoutRatio', '盈餘發放率', '%'), rangeClause('dividendCoverageRatio', '現金流量股利保障倍數', ' 倍')])
  return `本站有 ${count} 季的紀錄${clauses ? `：${clauses}` : '。'}`
})

// ③ the year rows summed（cash and stock separately）, newest year quoted.
const historyAnswer = computed(() => {
  const entries = history.value
  if (!entries.length) return null
  const years = entries.map(entry => entry.fiscalYear)
  const cash = entries.reduce((sum, entry) => sum + (entry.cashDividend ?? 0), 0)
  const stockDividend = entries.reduce((sum, entry) => sum + (entry.stockDividend ?? 0), 0)
  const latest = [...entries].sort((a, b) => b.fiscalYear - a.fiscalYear)[0]!
  const latestClauses = joinClauses([
    latest.cashDividend !== null ? `現金股利 ${latest.cashDividend.toFixed(2)} 元` : null,
    latest.payoutRatio !== null ? `現金股利發放率 ${latest.payoutRatio.toFixed(2)}%` : null,
    latest.exDividendDate ? `除息日 ${latest.exDividendDate}` : null,
    latest.paymentDate ? `發放日 ${latest.paymentDate}` : null
  ])
  const total = joinClauses([`合計現金股利 ${cash.toFixed(2)} 元`, stockDividend > 0 ? `股票股利 ${stockDividend.toFixed(2)} 元` : null])
  return `${stockShortName.value}自 ${Math.min(...years)} 年至 ${Math.max(...years)} 年共 ${entries.length} 個股利所屬年度有紀錄，${total ?? ''}${latestClauses ? `最近一個年度（${latest.fiscalYear} 年）：${latestClauses}` : ''}`
})

// ⑤ nearest scheduled ex-date（the notices endpoint only returns future events）.
const exDividendAnswer = computed(() => {
  const notices = exDividendNotices.value?.[code.value] ?? []
  if (!notices.length) return exDividendNotices.value ? '目前查無排定的除權息。' : null
  const next = [...notices].sort((a, b) => a.exDate.localeCompare(b.exDate))[0]!
  return joinClauses([`下次除${next.exType}日 ${next.exDate}`, next.cashDividend !== null ? `現金股利 ${next.cashDividend.toFixed(2)} 元` : null, next.stockDividendRatio !== null ? `股票股利比例 ${next.stockDividendRatio}` : null])
})
</script>

<template>
  <div v-loading="stockPending" class="app-page stock-dividend-page">
    <!-- Same three-way pending/not-found/found branch as stock/[code]/index.vue's own (see that
         file's own comment for why a bare v-if/v-else pair can't distinguish "still loading" from
         "genuinely doesn't exist"). -->
    <template v-if="stockPending" />
    <SharedStockNotFound v-else-if="!stock" />

    <template v-else>
      <!-- The page subject is rendered INTO the summary card's single <h1> (「台積電 2330 配股配息」)
           since 2026-09-19 — no separate page-level <h1>; see StockSummaryCard.vue's own comment. -->
      <StockSummaryCard :stock="stock" :is-emerging="profile?.isEmerging ?? null" :is-favorite="isFavorite" :short-name="stockShortName" topic="配股配息" @toggle-favorite="toggleFavorite" />
      <StockPageNav :code="code" />
      <StockBreadcrumb :items="breadcrumbs" />

      <StockQuestionSection id="stock-dividend-yield" :question="`${stockShortName}（${code}）殖利率是多少？`" :answer="overviewAnswer">
        <!-- The section's one visual: where this 殖利率 sits in the whole market（2026-09-18 per
             direct request）; the number itself and its rank are in the answer above. -->
        <StockDividendYieldPercentileCard :symbol="stock.code" :percentile="payerPercentile" />
      </StockQuestionSection>

      <StockQuestionSection id="stock-dividend-series" question="近幾季的配息數字怎麼變化？" :answer="seriesAnswer">
        <StockMetricSeriesTable :caption="`${stockShortName} ${code} 配息數列`" :columns="seriesColumns" :groups="groups" />
      </StockQuestionSection>

      <StockQuestionSection v-if="history.length" id="stock-dividend-history" :question="`${stockShortName}歷年配了多少股利？`" :answer="historyAnswer">
        <StockDividendHistoryTable :entries="history" :caption="`${stockShortName} ${code} 歷年股利`" />
      </StockQuestionSection>

      <StockQuestionSection id="stock-dividend-ex-date" question="下次除權息是什麼時候？" :answer="exDividendAnswer">
        <StockExDividendCard v-if="exDividendNotices" :notices="exDividendNotices[code] ?? []" />
        <StockExDividendCardShell v-else />
      </StockQuestionSection>

      <p class="stock-page-section__link">
        <NuxtLink :to="`/stock/${code}/metrics-history`">看 {{ stockShortName }} {{ code }} 的逐年指標數據</NuxtLink>
      </p>
      <StockPageDigest :digest="digest" />
    </template>
  </div>
</template>

<style scoped>

</style>
