<script setup lang="ts">
import type { FactItem } from '~/components/shared/SharedFactList.vue'
import type { PreferredPageResponse } from '#shared/types/screener-detail'
import type { Stock } from '~/composables/stock/useStocks'

// 特別股個別頁（2026-09-06 使用者要求「特別股清單以外，特別股個別瀏覽畫面」；2026-10-15 三組篩選重新設計時改寫）。
// - 骨架跟個股頁、ETF 個別頁同一個（StockPageShell），導覽換成篩選區的
// - 資料改在伺服器端讀（/api/preferred/:code）：原本整份清單在瀏覽器端才載，標題與內容要等 JavaScript 跑完才出現
// - 卡片換成兩段問答＋定義清單（使用者：一格一張卡片＝畫面髒亂）
// - 拿掉永遠顯示「尚未提供」的部分：償債能力、清算優先倍數、清算優先順位、投資人賣回權，上游一直是 null；只剩它們在用的
//   簡易／專家模式切換也一起拿掉
const route = useRoute()
const code = computed(() => String(route.params.code).toUpperCase())

const { data, pending, error, refresh } = await useFetch<PreferredPageResponse>(() => `/api/preferred/${code.value.toLowerCase()}`, {
  key: () => `preferred-page-${code.value}`
})
const notFound = computed(() => error.value?.statusCode === 404 || error.value?.statusCode === 400)
watchLoadFailure('preferred-page', () => (error.value && !notFound.value ? error.value : null), () => refresh())

const entry = computed(() => data.value?.stock ?? null)
const quote = computed(() => data.value?.quote ?? null)
const price = computed(() => quote.value?.price ?? entry.value?.latestClosePrice ?? null)
const priceDate = computed(() => quote.value?.tradeDate ?? entry.value?.latestPriceDate ?? null)
const stock = computed<Stock | null>(() => (entry.value
  ? { code: entry.value.symbol, name: entry.value.name, price: price.value, change: quote.value?.change ?? null, changePercent: quote.value?.changePercent ?? null }
  : null))
const shortName = computed(() => entry.value?.name ?? code.value)
const { isFavorite, toggleFavorite } = useWatchlistToggle(() => entry.value?.symbol, () => shortName.value)

const pct = (value: number | null | undefined) => (value === null || value === undefined ? '尚無資料' : `${value.toFixed(2)}%`)
const yuan = (value: number | null | undefined) => (value === null || value === undefined ? '尚無資料' : `${groupThousands(value.toFixed(2))} 元`)
const yesNo = (value: boolean | null, yes: string, no: string) => (value === null ? '尚無資料' : value ? yes : no)

// ---- 股息怎麼算 ----
const negativeConvexity = computed(() => (entry.value ? hasNegativeConvexityWarning(entry.value) : false))

const yieldAnswer = computed(() => {
  const stockEntry = entry.value
  if (!stockEntry) return null
  const parts = [`${shortName.value}（${code.value}）每年股息 ${yuan(stockEntry.dividendRate)}`]
  if (stockEntry.issuePrice !== null && stockEntry.nominalDividendRatePct !== null) parts.push(`，以發行價 ${yuan(stockEntry.issuePrice)}計算的票面利率 ${pct(stockEntry.nominalDividendRatePct)}`)
  if (price.value !== null && stockEntry.currentYieldPct !== null) parts.push(`；以 ${priceDate.value ?? '最新'}收盤價 ${yuan(price.value)}計算，殖利率 ${pct(stockEntry.currentYieldPct)}`)
  if (stockEntry.ytwPct !== null) parts.push(`，最差情境殖利率（YTW）${pct(stockEntry.ytwPct)}`)
  return `${parts.join('')}。`
})

const yieldFacts = computed<FactItem[]>(() => {
  const stockEntry = entry.value
  if (!stockEntry) return []
  return [
    { label: '每年股息', value: yuan(stockEntry.dividendRate) },
    { label: '發行價', value: yuan(stockEntry.issuePrice) },
    { label: '票面利率', value: pct(stockEntry.nominalDividendRatePct), note: '股息 ÷ 發行價' },
    { label: '現價', value: yuan(price.value), note: priceDate.value ?? undefined },
    { label: '殖利率', value: pct(stockEntry.currentYieldPct), note: '股息 ÷ 現價' },
    { label: '最差殖利率 YTW', value: pct(stockEntry.ytwPct), note: '持有到期與被收回兩種情況取較低者' },
    {
      label: '溢價率',
      value: pct(stockEntry.premiumRatePct),
      note: negativeConvexity.value ? '現價高於發行價：公司依條款收回時，以發行價收回，高出的部分是損失' : '（現價 − 發行價）÷ 發行價',
      warning: negativeConvexity.value
    }
  ]
})

// ---- 權利與條款 ----
const termsAnswer = computed(() => {
  const stockEntry = entry.value
  if (!stockEntry) return null
  const terms = [
    stockEntry.cumulativeDividend === null ? null : stockEntry.cumulativeDividend ? '累積型（當年沒發的股息之後補發）' : '非累積型（當年沒發的股息不補發）',
    stockEntry.participatingExcessDividend === null ? null : stockEntry.participatingExcessDividend ? '參加型' : '非參加型',
    stockEntry.convertible ? '可以轉換成普通股' : null,
    stockEntry.redeemable ? '發行公司可以依條款收回' : null
  ].filter((term): term is string => term !== null)
  return terms.length ? `這檔特別股是${terms.join('、')}。` : null
})

const termFacts = computed<FactItem[]>(() => {
  const stockEntry = entry.value
  if (!stockEntry) return []
  return [
    { label: '股息累積性', value: yesNo(stockEntry.cumulativeDividend, '累積型', '非累積型') },
    { label: '股息參與權', value: yesNo(stockEntry.participatingExcessDividend, '參加型', '非參加型'), note: stockEntry.participatingExcessDividend ? '可以再參加普通股的盈餘分配' : undefined },
    { label: '清算優先權', value: yesNo(stockEntry.liquidationPreference, '優先於普通股', '無') },
    { label: '表決權', value: yesNo(stockEntry.votingRights, '有', '無') },
    { label: '可轉換普通股', value: yesNo(stockEntry.convertible, '可以', '不可以'), note: stockEntry.convertible && stockEntry.conversionStartDate ? `${stockEntry.conversionStartDate} 起` : undefined },
    { label: '公司可收回', value: yesNo(stockEntry.redeemable, '可以', '不可以') },
    { label: '發行日', value: stockEntry.issueDate ?? '尚無資料' },
    { label: '上市日', value: stockEntry.listedDate ?? '尚無資料' },
    { label: '市場', value: stockEntry.marketType }
  ]
})

// ---- 頁面 ----
const breadcrumbs = computed(() => [
  { label: '首頁', to: '/' },
  { label: '特別股篩選', to: SCREENER_PATHS.preferred },
  { label: `${shortName.value} ${code.value}`, to: preferredStockPath(code.value) }
])

useHubPageSeo({
  title: () => (entry.value ? `${shortName.value} ${code.value} 特別股：股息、殖利率與條款` : '找不到這檔特別股'),
  description: () => yieldAnswer.value ?? `${code.value} 特別股的股息、殖利率與發行條款。`,
  path: () => preferredStockPath(code.value),
  breadcrumbs,
  noindex: () => !entry.value
})

const footer = {
  sources: ['公開資訊觀測站（發行條件）', '證交所、櫃買中心（收盤價）'],
  links: [
    { to: SCREENER_PATHS.preferred, label: '特別股篩選' },
    { to: '/blog/what-is-preferred-stock', label: '特別股入門' }
  ]
}
</script>

<template>
  <StockPageShell
    class="app-page preferred-page"
    :code="code"
    :stock="stock"
    :pending="pending || (!!error && !notFound)"
    :is-emerging="null"
    :is-favorite="isFavorite"
    :short-name="shortName"
    topic="特別股股息與條款"
    subject="特別股"
    :breadcrumbs="breadcrumbs"
    :footer="footer"
    @toggle-favorite="toggleFavorite"
  >
    <template #nav>
      <ScreenerNav :active-to="SCREENER_PATHS.preferred" />
    </template>

    <StockQuestionSection id="preferred-yield" :question="`${shortName}（${code}）的股息怎麼算？`" :answer="yieldAnswer">
      <SharedFactList :items="yieldFacts" :label="`${shortName}的股息與殖利率`" />
    </StockQuestionSection>

    <StockQuestionSection id="preferred-terms" question="有哪些權利與條款？" :answer="termsAnswer">
      <SharedFactList :items="termFacts" :label="`${shortName}的權利與條款`" />
    </StockQuestionSection>
  </StockPageShell>
</template>
