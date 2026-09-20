<script setup lang="ts">
import type { StockContextResponse } from '#shared/types/stock-context'
import { factTexts, joinClauses, rankSentence } from '~/utils/stock-answers'

const route = useRoute()
const router = useRouter()

const code = computed(() => String(route.params.code))

// Real bug fixed 2026-09-14 (reported live: "summary-card 殖利率 1.6% 與 股利資訊卡片的 0.91%
// 對不起來") — `stock` used to come from getStockByCode(useStockUniverse().data, code), and
// useStockUniverse() silently falls back to a hardcoded ~20-stock MOCK_STOCK_UNIVERSE whenever
// GET /api/stocks fails — which it always does, since that endpoint has never existed (see
// useStocks.ts's own comment). Extracted into useStockDetailSummary.ts 2026-09-17 — every one of
// this stock's sub-pages needs this exact same StockSummaryCard header.
const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite, summary } = useStockDetailSummary(code)

// The metric catalog is awaited ONCE here, before any card mounts — StockFinancialHighlightsRisksCard
// and StockCardTitle both read it, and several sibling components calling useFilterSchema() at the
// same moment is the shared-key race (feedback_useasyncdata_shared_key_race memory).
await useFilterSchema()

// Peers（supply-chain group + side-by-side values）and four market-wide ranks — the
// 「同業有哪些？」and「在全市場排第幾？」sections（/api/stock/:code/context, cached per symbol）.
const contextData = useAsyncData<StockContextResponse | null>(
  () => `stock-context-${code.value}`,
  async () => {
    const symbol = code.value
    if (!symbol) return null
    try {
      return await $fetch<StockContextResponse>(`/api/stock/${symbol}/context`, { retry: 0, timeout: 15_000 })
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[stock-context] GET /api/stock/${symbol}/context unavailable (${reason})`)
      }
      return null
    }
  },
  { watch: [code], default: () => null }
)

// Real numbers into the server-rendered HTML — the section answers, the「資料摘要與來源」section,
// the meta description, and a pre-warmed badge cache so StockFinancialHighlightsRisksCard renders
// in SSR too (see useStockPageDigest.ts).
const { digest, description, series } = await useStockPageDigest(code, 'index', { shortName: stockShortName })
await contextData
const context = computed(() => contextData.data.value)

// This page's own body content — 卡片/表格/會計 moved out to their own routes 2026-09-18; the
// index became「財報亮點與風險」on 2026-09-19 (StockFinancialHighlightsRisksCard) and, with the SEO
// build the same day, a document about the company: what it is, its highlights/risks count, its
// market-wide ranks, its peers with a comparison table, and a short FAQ of the numbers people
// search for — every one of them in the SSR HTML. No FAQPage JSON-LD on purpose (Google dropped
// that rich result for sites like this in 2023; plain <h3>/<p> is what gets read).

// 「是什麼公司？」(the profile section: a prose answer plus a 7-row 市場/類股/成立日期/董事長…
// stat list) was removed 2026-09-20 on direct instruction. Its whole supporting cast went with
// it — isoDate, sector, sectorLink, profileAnswer, profileFields — since nothing else read them.
// `sectorCode` stays: useStockPageSeo still needs it for the breadcrumb's 類股 level.
const sectorCode = computed(() => profile.value?.industry ?? null)

// ② 亮點與風險 — counts from the same badge payload the card renders（passed true/false/null）.
const badgeAnswer = computed(() => {
  const badges = series.value?.badges
  if (!badges) return null
  const entries = badges.categories.flatMap(category => category.badges)
  if (!entries.length) return null
  const met = entries.filter(entry => entry.passed === true).length
  const unmet = entries.filter(entry => entry.passed === false).length
  const unknown = entries.length - met - unmet
  return `本站 ${entries.length} 項大師徽章指標中，${stockShortName.value}目前符合 ${met} 項、未符合 ${unmet} 項${unknown ? `、無法判定 ${unknown} 項` : ''}；各項的門檻與目前數值列於下方。`
})

// A per-page SSR table of this same badge/threshold/value/passed data was added and then removed
// the same day (2026-09-20) — direct feedback that it duplicated StockFinancialHighlightsRisksCard's
// own three lists too heavily to justify a second representation. Same reasoning as check-stock-
// pages.mjs's own f-score exemption: forcing list-shaped content into a <table> just to satisfy a
// "every page needs an SSR table" rule marks it up as something it isn't. The card (richer:
// categorized, clickable, carries the badge-page entry-point links) is the one representation;
// this route is exempted from the ssrTables check the same way f-score is.

// ③ 全市場排第幾？— one sentence per rank field（statistical position only）.
const RANK_LABELS: Record<string, { label: string; unit: string }> = {
  'roe.TTM': { label: '近四季 ROE', unit: '%' },
  'eps.TTM': { label: '近四季 EPS', unit: '元' },
  'dividendYield.EOD': { label: '殖利率', unit: '%' },
  'debtRatio.Q': { label: '單季負債比率', unit: '%' }
}

// dividendYield.EOD's own GET /screener/company-rank call uses excludeZero:true
// (server/api/stock/[code]/context.get.ts's own RANK_FIELDS) — its rank.totalCount already
// excludes non-payers, so its sentence names that narrower population instead of the 全市場
// every other field here still ranks against. See rankSentence()'s own comment.
const RANK_POPULATION_LABELS: Record<string, string> = { 'dividendYield.EOD': '有配息公司中' }

const rankSentences = computed(() =>
  (context.value?.ranks ?? [])
    .map(item => {
      const meta = RANK_LABELS[item.field]
      return meta ? rankSentence(meta.label, meta.unit, item.rank, item.direction, RANK_POPULATION_LABELS[item.field]) : null
    })
    .filter((sentence): sentence is string => sentence !== null)
)

const rankAnswer = computed(() => (rankSentences.value.length ? `名次是全市場有該指標資料的公司依數值排序後的位置（負債比率由低到高，其餘由高到低；殖利率名次不含未配息公司），不是本站的評等。` : null))

// 「同業有哪些？」(supply-chain peer table) removed 2026-09-20 — analysis-ts hard-deleted GET
// /companies/peer-group with no replacement (commit a7489d65); see StockContextResponse's own
// comment. context.value now only carries `ranks`.

// ⑤ 常見問題 — h3 questions answered with the page's own numbers; an item with no number is left out.
const faqItems = computed<{ question: string; answer: string }[]>(() => {
  const name = stockShortName.value
  const price = summary.value?.price
  const valuation = summary.value?.valuation
  const pe = digest.value?.percentiles.find(item => item.code === 'peRatio')
  const latestPeriod = digest.value?.latestPeriod?.label
  const items: { question: string; answer: string | null }[] = [
    { question: `${name}的股價是多少？`, answer: price ? `${price.tradeDate} 收盤 ${price.close.toFixed(2)} 元。` : null },
    { question: `${name}的本益比是多少？`, answer: valuation?.peRatio !== null && valuation?.peRatio !== undefined ? `${valuation.tradeDate} 本益比 ${valuation.peRatio.toFixed(2)} 倍${pe ? `，位於${pe.windowLabel}第${pe.percentile}百分位（${pe.bandLabel}）` : ''}。` : null },
    { question: `${name}的殖利率是多少？`, answer: valuation?.dividendYield !== null && valuation?.dividendYield !== undefined ? joinClauses([`${valuation.tradeDate} 殖利率 ${valuation.dividendYield.toFixed(2)}%`, ...factTexts(digest.value, ['dividendPerShare'])]) : null },
    { question: `${name}的 EPS 是多少？`, answer: factTexts(digest.value, ['eps']).length ? `${factTexts(digest.value, ['eps'])[0]}${latestPeriod ? `（最新財報 ${latestPeriod}）` : ''}。` : null },
    { question: `${name}連續配息幾年？`, answer: joinClauses(factTexts(digest.value, ['consecutiveDividendYears', 'dividendPayoutRatio'])) }
  ]
  return items.filter((item): item is { question: string; answer: string } => !!item.answer)
})

// title/description/og/robots/canonical/BreadcrumbList all in one place (2026-09-19) — this page
// used to set only a self-referencing canonical and no <title> at all. See useStockPageSeo.ts.
const { breadcrumbs } = useStockPageSeo({ code, shortName: stockShortName, topic: '財報亮點與風險', titleKeywords: '本益比、EPS 與財報亮點', pathSuffix: '', stock, summary, description, sectorCode })
</script>

<template>
  <div v-loading="stockPending" class="stock-detail-page">
    <!-- Three-way branch (pending/not-found/found), not a plain v-if/v-else pair — same fix
         preferred-stocks/[code].vue already needed for the identical reason (see that file's own
         comment): stock is now a real async fetch (useStockSummary/useCompanyProfile), so a bare
         "找不到這檔股票" would flash on every first paint while those are still in flight, not
         just for a genuinely wrong code. -->
    <template v-if="stockPending" />
    <el-result
      v-else-if="!stock"
      icon="warning"
      sub-title="請確認股票代號是否正確"
    >
      <!-- Real <h1> in the not-found state too (2026-09-19) — el-result's default title is a <p>,
           which left this branch with no heading at all; the page is also `noindex` here (see
           useStockPageSeo.ts's soft-404 note). -->
      <template #title>
        <h1 class="stock-not-found__title">找不到這檔股票</h1>
      </template>
      <template #extra>
        <el-button type="primary" @click="router.push('/')">回首頁</el-button>
      </template>
    </el-result>

    <template v-else>
      <!-- Page subject lives in the summary card's single <h1> (「台積電 2330 財報亮點與風險」)
           since 2026-09-19 — see StockSummaryCard.vue's own heading comment. -->
      <StockSummaryCard :stock="stock" :website="profile?.website ?? null" :is-favorite="isFavorite" :short-name="stockShortName" topic="財報亮點與風險" @toggle-favorite="toggleFavorite" />
      <!-- SSR'd, in-body sub-page navigation (2026-09-19) — replaces the ClientOnly/Teleport
           sidebar that crawlers and mobile users never saw; see StockPageNav.vue's own comment. -->
      <StockPageNav :code="code" />
      <StockBreadcrumb :items="breadcrumbs" />

      <StockQuestionSection id="stock-highlights" :question="`${stockShortName}的財報亮點與風險有哪些？`" :answer="badgeAnswer">
        <!-- 財報亮點／財報風險 (2026-09-19 per direct request "我決定個股瀏覽 stock/2330 放財報亮點
             跟 財報風險") — the existing guru-badge met/unmet system, flattened across categories,
             not a new judgment layer; see StockFinancialHighlightsRisksCard.vue. -->
        <!-- A separate list of links to this symbol's badge pages sat here for a few hours on
             2026-09-20 and was removed: three of its four links already existed in the table's own
             詳情 column, and a second link to the same URL from the same page adds nothing for
             crawling or ranking (Google consolidates them) while costing a retiree-audience page
             real screen space. Its one non-duplicate link (f-score) was the real finding — f-score
             wasn't in BADGE_PAGES, so its entry point had ended up somewhere different from the
             other three badges'. Fixed at the root: f-score joined the registry, so its own row in
             the table links like every other badge page's row does. -->
        <StockFinancialHighlightsRisksCard :symbol="stock.code" />
      </StockQuestionSection>

      <StockQuestionSection v-if="rankSentences.length" id="stock-ranks" :question="`${stockShortName}的 ROE、殖利率在全市場排第幾？`" :answer="rankAnswer">
        <ul class="stock-rank-list">
          <li v-for="sentence in rankSentences" :key="sentence">{{ sentence }}</li>
        </ul>
      </StockQuestionSection>

      <!-- Phrased as a real question since 2026-09-20: removing the 是什麼公司 section above took
           the page from exactly 3 question-form <h2>s to 2, under check-stock-pages.mjs's own
           `questionH2s >= 3` floor. Rewording this heading restores the count honestly — the
           alternative was lowering the floor, which would weaken a rule that still holds. -->
      <StockQuestionSection v-if="faqItems.length" id="stock-faq" :question="`關於${stockShortName}（${code}）有哪些常見問題？`">
        <div v-for="item in faqItems" :key="item.question" class="stock-faq">
          <h3 class="stock-faq__question">{{ item.question }}</h3>
          <p class="stock-answer">{{ item.answer }}</p>
        </div>
        <p class="stock-page-section__link">
          <NuxtLink :to="`/stock/${code}/dividend`">看 {{ stockShortName }} {{ code }} 的配股配息、歷年股利與下次除權息</NuxtLink>
        </p>
      </StockQuestionSection>

      <StockPageDigest :digest="digest" />
    </template>
  </div>
</template>

<style scoped>
/* No max-width/margin here on purpose — every other page gets its width from layouts/default.vue's
   own .app-shell__inner / .app-shell__inner--centered wrapper (the 置中/滿版 switch), so this page
   should too rather than fighting it with a second, independent cap. */
.stock-detail-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.stock-rank-list {
  margin: 0;
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 1rem;
  line-height: 1.7;
  color: var(--el-text-color-regular);
  font-variant-numeric: tabular-nums;
}

.stock-faq {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stock-faq__question {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
</style>
