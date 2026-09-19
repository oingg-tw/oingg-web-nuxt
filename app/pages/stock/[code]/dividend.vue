<script setup lang="ts">
import type { FilterSchema } from '~/composables/screener/useFilterSchema'
import type { SeriesTableColumn } from '~/utils/stock-series-table'
import { catalogColumn, periodLabel } from '~/utils/stock-series-table'
import { formatSeriesNumber } from '~/utils/metric-null-reason'
import { factTexts, joinClauses, joinSentences, rankSentence } from '~/utils/stock-answers'

// 配股配息 — real route 2026-09-17 ("配股配息url改名 stock/2330/dividend"); the 股息哪裡來 cash-chain
// cards merged in 2026-09-19 (their former /dividend-source route is gone).
//
// Rebuilt as a document on 2026-09-19 (the SEO build), on the user's own diagnosis of the old
// card-per-metric layout（「畫面髒亂」）: five question-form sections, each a short number-led answer
// followed by one table or one card —「配了多少股利？殖利率多少？」(answer + the market-percentile
// gauge as the section's one visual),「近幾季的配息數字怎麼變化？」(the 配息數列 table, every
// quarter bff-ts has),「歷年配了多少股利？」(the new dividend-history table),「股息從哪裡來？」(the
// cash-chain equations) and「下次除權息是什麼時候？」. The 配息穩定度 tile card is gone — its four
// numbers are the first answer's own sentence now. Everything a crawler reads is in the SSR HTML:
// the series come from /api/stock/:code/series?page=dividend（useStockPageDigest）.
const route = useRoute()
const router = useRouter()
const code = computed(() => String(route.params.code))

const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite, summary } = useStockDetailSummary(code)

// Always the route's own code — the earlier `stock.value ? [code] : []` was `[]` during SSR (the
// summary hadn't resolved when this ran), so the notices were never server-fetched and the
// ex-date clause appeared only after hydration (found 2026-09-19).
const { data: exDividendNotices } = useExDividendNotices(computed(() => [code.value]))

// Catalog awaited once before any card mounts (feedback_useasyncdata_shared_key_race memory).
await useFilterSchema()
const { data: filterSchema } = useNuxtData<FilterSchema>('filter-schema')

const { digest, description, series } = await useStockPageDigest(code, 'dividend', { shortName: stockShortName, exDividendNotices })

const sectorCode = computed(() => profile.value?.industry ?? null)
const { breadcrumbs } = useStockPageSeo({ code, shortName: stockShortName, topic: '配股配息', titleKeywords: '股利、殖利率與配息紀錄', pathSuffix: '/dividend', stock, summary, description, sectorCode })

const groups = computed(() => series.value?.groups ?? {})
const history = computed(() => series.value?.dividendHistory?.entries ?? [])
const yieldRank = computed(() => series.value?.ranks?.find(item => item.field === 'dividendYield.EOD')?.rank ?? null)

// Column labels/units come from the metric catalog（same names the cards and the digest use）.
const seriesColumns = computed<SeriesTableColumn[]>(() =>
  ['dividendPerShare', 'dividendPayoutRatio', 'dividendCoverageRatio', 'shareholderYield', 'fcfPerShare', 'ocfPerShare'].map(metricCode => catalogColumn(filterSchema.value?.categories ?? [], metricCode, 'TTM_DIV_40', 'TTM'))
)

// ① 配了多少股利？殖利率多少？— the digest's own latest-period facts plus the market rank.
const overviewAnswer = computed(() => {
  const valuation = summary.value?.valuation
  const rank = rankSentence('殖利率', '%', yieldRank.value, 'desc')
  const yieldClause = rank
    ? `${rank}${valuation?.tradeDate ? `（${valuation.tradeDate}）` : ''}。`
    : valuation?.dividendYield !== null && valuation?.dividendYield !== undefined
      ? `殖利率 ${valuation.dividendYield.toFixed(2)}%（${valuation.tradeDate}）。`
      : null
  return joinSentences([joinClauses(factTexts(digest.value, ['dividendPerShare', 'dividendPayoutRatio', 'shareholderYield', 'consecutiveDividendYears'])), yieldClause])
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

// ④ the cash chain as one sentence（the equation cards below show the same four numbers）.
const cashChainAnswer = computed(() => joinClauses(factTexts(digest.value, ['eps', 'ocfPerShare', 'fcfPerShare', 'dividendPerShare'])))

// ⑤ nearest scheduled ex-date（the notices endpoint only returns future events）.
const exDividendAnswer = computed(() => {
  const notices = exDividendNotices.value?.[code.value] ?? []
  if (!notices.length) return exDividendNotices.value ? '目前查無排定的除權息。' : null
  const next = [...notices].sort((a, b) => a.exDate.localeCompare(b.exDate))[0]!
  return joinClauses([`下次除${next.exType}日 ${next.exDate}`, next.cashDividend !== null ? `現金股利 ${next.cashDividend.toFixed(2)} 元` : null, next.stockDividendRatio !== null ? `股票股利比例 ${next.stockDividendRatio}` : null])
})
</script>

<template>
  <div v-loading="stockPending" class="stock-dividend-page">
    <!-- Same three-way pending/not-found/found branch as stock/[code]/index.vue's own (see that
         file's own comment for why a bare v-if/v-else pair can't distinguish "still loading" from
         "genuinely doesn't exist"). -->
    <template v-if="stockPending" />
    <el-result
      v-else-if="!stock"
      icon="warning"
      sub-title="請確認股票代號是否正確"
    >
      <template #title>
        <h1 class="stock-not-found__title">找不到這檔股票</h1>
      </template>
      <template #extra>
        <el-button type="primary" @click="router.push('/')">回首頁</el-button>
      </template>
    </el-result>

    <template v-else>
      <!-- The page subject is rendered INTO the summary card's single <h1> (「台積電 2330 配股配息」)
           since 2026-09-19 — no separate page-level <h1>; see StockSummaryCard.vue's own comment. -->
      <StockSummaryCard :stock="stock" :website="profile?.website ?? null" :is-favorite="isFavorite" :short-name="stockShortName" topic="配股配息" @toggle-favorite="toggleFavorite" />
      <StockPageNav :code="code" />
      <StockBreadcrumb :items="breadcrumbs" />

      <StockQuestionSection id="stock-dividend-overview" :question="`${stockShortName}（${code}）配了多少股利？殖利率多少？`" :answer="overviewAnswer">
        <!-- The section's one visual: where this 殖利率 sits in the whole market（2026-09-18 per
             direct request）; the number itself and its rank are in the answer above. -->
        <StockDividendYieldPercentileCard :symbol="stock.code" />
      </StockQuestionSection>

      <StockQuestionSection id="stock-dividend-series" question="近幾季的配息數字怎麼變化？" :answer="seriesAnswer">
        <StockMetricSeriesTable :caption="`${stockShortName} ${code} 配息數列`" :columns="seriesColumns" :groups="groups" />
      </StockQuestionSection>

      <StockQuestionSection v-if="history.length" id="stock-dividend-history" :question="`${stockShortName}歷年配了多少股利？`" :answer="historyAnswer">
        <StockDividendHistoryTable :entries="history" :caption="`${stockShortName} ${code} 歷年股利`" />
      </StockQuestionSection>

      <StockQuestionSection id="stock-dividend-cash-chain" question="股息從哪裡來？" :answer="cashChainAnswer">
        <!-- 每股股利＋留存現金＝每股自由現金流 → …＝每股營業現金流 → EPS＋非現金調整＝每股營業現金流,
             plus the 法定盈餘公積 rule — the equation cards that won the 2026-09-19 A/B against the
             waterfall chart; their numbers are in the SSR HTML through the series pre-warm. -->
        <StockDividendCashChainCard :symbol="stock.code" />
      </StockQuestionSection>

      <StockQuestionSection id="stock-dividend-ex-date" question="下次除權息是什麼時候？" :answer="exDividendAnswer">
        <StockExDividendCard v-if="exDividendNotices" :notices="exDividendNotices[code] ?? []" />
        <StockExDividendCardShell v-else />
      </StockQuestionSection>

      <p class="stock-page-section__link">
        <NuxtLink :to="`/stock/${code}/company-health#stock-section-股東回饋`">看 {{ stockShortName }} {{ code }} 的股東回饋指標數列</NuxtLink>
      </p>
      <StockPageDigest :digest="digest" />
    </template>
  </div>
</template>

<style scoped>
.stock-dividend-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
</style>
