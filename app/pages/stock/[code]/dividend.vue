<script setup lang="ts">
import type { MetricCatalog } from '~/composables/screener/useFilterSchema'
import type { StockDividendYieldHistoryResponse } from '#shared/types/stock-dividend-yield-history'
// 配股配息（路由 2026-09-17）。2026-09-19 依「畫面髒亂」改成文件式：問句區段、短答句、一張表。四段——殖利率是多少（答句＋
// 市場百分位量表）、近幾季的配息數字怎麼變化、歷年配了多少股利、下次除權息是什麼時候。資料全部在 SSR HTML 裡，來自
// /api/stock/:code/series?page=dividend（useStockPageDigest）。
// 2026-10-15 第一段改成先跟自己比（使用者：「重新設計 dividend 該指標都先跟自己比，就像其他多數指標一樣」）：殖利率歷年走勢＋答句
// 寫這檔自己近幾年的區間。殖利率歷史是業務中台 4dcd116 的 GET /stocks/:symbol/dividend-yield-history（月底取樣，口徑同摘要卡）。
// 原本第一段的全市場百分位與分布圖（StockDividendYieldPercentileCard）同日先拿掉（使用者：「跟其他配息公司比，殖利率在哪裡 這個
// 先刪掉。我另外想想怎麼辦」）；元件與 series 的 payerPercentile 先留著，等決定怎麼放回來。
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
const dividendDefinition = computed(() => firstSentence(findMetricInSchema(filterSchema.value?.categories ?? [], 'dividendYield')?.metric.description))

const { digest, description, series } = await useStockPageDigest(code, 'dividend', { shortName: stockShortName, exDividendNotices })

// 殖利率歷史：次要資料，讀不到不擋整頁（scope section），只少第一段的圖與「自己的區間」那半句
const { data: yieldHistory, refresh: refreshYieldHistory } = await useFetch<StockDividendYieldHistoryResponse>(() => `/api/stock/${code.value}/dividend-yield-history`, {
  key: () => `stock-dividend-yield-history-${code.value}`,
  watch: [code]
})
watchLoadFailure(() => `stock-dividend-yield-history:${code.value}`, () => yieldHistory.value?.entries === null, refreshYieldHistory, { scope: 'section' })
const yieldEntries = computed(() => yieldHistory.value?.entries ?? [])

const sectorCode = computed(() => profile.value?.sectorCode ?? null)
const { breadcrumbs } = useStockPageSeo({ code, shortName: stockShortName, topic: '配股配息', titleKeywords: '股利、殖利率與配息紀錄', pathSuffix: '/dividend', stock, summary, description, sectorCode })

const history = computed(() => series.value?.dividendHistory?.entries ?? [])

// 一頁一張表（2026-10-15，使用者：「為什麼又有 每季配息歷年變化 又有 年度股利歷年變化? 我們沒有統一說一個指標只能留一個表嗎?」→
// 留年度股利）：原本的「每季配息」表（近四季每股股利、盈餘發放率、現金流量股利保障倍數）拿掉，後兩支有自己的指標頁，連結在頁尾。

// ① 殖利率是多少？— scoped down to just the cash yield itself (2026-09-21, direct request
// 「stock/2330/dividend 不要有總覽概念，這樣資訊會太多。dividend 就讓它是現金殖利率就好。總回饋律那邊
// 才把股票股利與買回等等加總看」). Used to also state dividendPerShare/dividendPayoutRatio/
// shareholderYield/consecutiveDividendYears via factTexts() — dropped, not trimmed for length:
// those four are a different question (how much did the company pay in total, from which
// mechanisms) than this one (what's the cash yield), and shareholderYield in particular now has
// its own dedicated page (/stock/:code/shareholder-yield, 2026-09-21) that IS the "add cash
// dividends + buybacks together" view — restating it here would be the same kind of duplication
// already removed from the badge/metric 目前值 cards.
const todayYieldText = computed(() => {
  const valuation = summary.value?.valuation
  if (valuation?.dividendYield === 0) return `最近一年度${NO_DIVIDEND_TEXT}（${valuation.tradeDate}）。`
  return valuation?.dividendYield !== null && valuation?.dividendYield !== undefined
    ? `殖利率 ${valuation.dividendYield.toFixed(2)}%（${valuation.tradeDate}）。`
    : null
})
// ① 先跟自己比：這檔自己每月月底的殖利率落在哪個區間。只陳述數字，不說高低代表什麼（不是買賣建議）
const ownRangeText = computed(() => {
  const values = yieldEntries.value.flatMap(entry => (entry.value === null ? [] : [entry.value]))
  if (values.length < 12) return null
  const sorted = [...values].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]!
  const from = yieldEntries.value[0]!.tradeDate.slice(0, 7)
  if (sorted.at(-1) === 0) return `${from} 以來每月月底都是${NO_DIVIDEND_TEXT}。`
  return `${from} 以來每月月底的殖利率介於 ${sorted[0]!.toFixed(2)}% 到 ${sorted.at(-1)!.toFixed(2)}%，中位數 ${median.toFixed(2)}%。`
})
const overviewAnswer = computed(() => joinSentences([todayYieldText.value, ownRangeText.value]))


const footerLinks = computed(() => [
  { to: `/learn/dividend-source/${code.value}`, label: `${stockShortName.value} ${code.value} 的配息從哪來（新手專區）` },
  { to: `/stock/${code.value}/dividend-payout-ratio`, label: '盈餘發放率' },
  { to: `/stock/${code.value}/dividend-coverage-ratio`, label: '現金流量股利保障倍數' }
])

// ③ the year rows summed（cash and stock separately）, newest year quoted.
const historyAnswer = computed(() => {
  const entries = history.value
  if (!entries.length) return null
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
  return `${historyText.value.answer}${total ?? ''}${latestClauses ? `最近一個年度（${latest.fiscalYear} 年）：${latestClauses}` : ''}`
})
const historyText = computed(() => {
  const years = history.value.map(entry => entry.fiscalYear)
  return historyTableText({ shortName: stockShortName.value, code: code.value, topic: '年度股利', count: years.length, countUnit: '個年度', from: years.length ? `${Math.min(...years)} 年` : '', to: years.length ? `${Math.max(...years)} 年` : '' })
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
  <StockPageShell
    class="app-page stock-dividend-page"
    :code="code"
    :stock="stock"
    :pending="stockPending"
    :is-emerging="profile?.isEmerging ?? null"
    :is-favorite="isFavorite"
    :short-name="stockShortName"
    topic="配股配息"
    :breadcrumbs="breadcrumbs"
    :footer="{ sources: digest?.sources ?? [], freshness: digest && buildDigestFreshnessText(digest), links: footerLinks }"
    @toggle-favorite="toggleFavorite"
  >
    <StockQuestionSection id="stock-dividend-yield" :question="`${stockShortName}（${code}）殖利率是多少？`" :answer="overviewAnswer">
      <StockDividendYieldHistoryChart v-if="yieldEntries.length" :entries="yieldEntries" :cash-dividends="yieldHistory?.cashDividends ?? []" />
    </StockQuestionSection>

    <StockQuestionSection v-if="history.length" id="stock-dividend-history" :question="historyText.question" :answer="historyAnswer">
      <StockDividendHistoryTable :entries="history" :label="historyText.label" />
    </StockQuestionSection>

    <StockQuestionSection id="stock-dividend-ex-date" question="下次除權息是什麼時候？" :answer="exDividendAnswer">
      <StockExDividendCard v-if="exDividendNotices" :notices="exDividendNotices[code] ?? []" />
      <StockExDividendCardShell v-else />
    </StockQuestionSection>

    <!-- 頁尾前的定義區（2026-10-14 指標頁一致性盤點，「關係頁補定義區」）：這一頁的主線是殖利率 -->
    <template #guide>
      <StockMetricGuide id-prefix="stock-dividend" topic="殖利率" :definition="dividendDefinition ? [dividendDefinition] : []" />
    </template>
  </StockPageShell>
</template>

