<script setup lang="ts">

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

// Real numbers into the server-rendered HTML — the section answer, the「資料摘要與來源」section,
// the meta description, and a pre-warmed badge cache so StockFinancialHighlightsRisksCard renders
// in SSR too (see useStockPageDigest.ts).
const { digest, description, series } = await useStockPageDigest(code, 'index', { shortName: stockShortName })

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
// categorized, clickable, carries the badge-page entry-point links) is the one representation —
// and it IS a real `data-ssr-table` itself since its rewrite later that day, so this route needs
// no ssrTables exemption (the one it briefly carried was removed again).

// 「在全市場排第幾？」(four rank sentences) and 「常見問題」(the FAQ h3 block) were both removed
// 2026-09-20 on direct instruction, in the same pass that had already removed 「是什麼公司？」and
// 「同業有哪些？」. That empties this page of everything except 財報亮點與風險 and the digest, and
// takes /api/stock/:code/context's last consumer with it, so that route and its StockContextResponse
// envelope were deleted in the same commit. cachedCompanyRank and StockContextRank both STAY —
// they're reached through a different path, StockSeriesResponse.ranks, which the 配股配息 page
// reads for its 殖利率 rank.

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

</style>
