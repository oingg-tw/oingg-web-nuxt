<script setup lang="ts">
const route = useRoute()
const router = useRouter()

const code = computed(() => String(route.params.code))

// Real bug fixed 2026-09-14 (reported live: "summary-card 殖利率 1.6% 與 股利資訊卡片的 0.91%
// 對不起來") — `stock` used to come from getStockByCode(useStockUniverse().data, code), and
// useStockUniverse() silently falls back to a hardcoded ~20-stock MOCK_STOCK_UNIVERSE whenever
// GET /api/stocks fails — which it always does, since that endpoint has never existed (see
// useStocks.ts's own comment). 2330's dividendYield was a stale fixture number (1.6), not a real
// one; StockDividendInfoCard.vue's 0.91% was the real one, from an actual metric query. Worse,
// any symbol NOT in that 20-stock list made the whole page show "找不到這檔股票" outright — this
// broke the vast majority of the real market, not just wrong-but-present numbers for a few names.
//
// Extracted into useStockDetailSummary.ts 2026-09-17 ("整頁滑動的概念完全捨棄...只有Header部分會
// 長相一樣") — every one of this stock's sub-pages (dividend/dividend-source/financial-statements/
// metrics-history/company-health) needs this exact same StockSummaryCard header, so it's a shared
// composable now instead of only living here.
const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite, summary } = useStockDetailSummary(code)

// title/description/og/robots/canonical/BreadcrumbList all in one place (2026-09-19) — this page
// used to set only a self-referencing canonical (added 2026-09-12 so `?…` view-state variants
// never get indexed as separate pages) and no <title> at all. See useStockPageSeo.ts.
const { breadcrumbs } = useStockPageSeo({ code, shortName: stockShortName, topic: '財報亮點與風險', pathSuffix: '', stock, summary })

// This page's own body content — 卡片/表格/會計 (the three experienceMode branches this file used
// to switch between with its own mode-picker) — moved out to their own dedicated routes 2026-09-18,
// each reachable from the sidebar instead of a mode switch: company-health.vue (卡片), 財務報表
// (會計，見 financial-statements.vue), 指標歷史 (表格，見 metrics-history.vue). Per direct request
// ("summary 上面的 卡片 表格 會計 顯示設定 都拔掉。所有卡片一律呈現。卡片 表格 會計 做在sidebar
// 上面") — this page is now just the shared StockSummaryCard header plus the sidebar itself; no
// mode-switcher UI, no StockDetailActions (顯示設定, removed from every one of these pages the same
// day), no persistent card content of its own.
//
// 財報亮點／財報風險 added 2026-09-19 per direct request ("我決定個股瀏覽 stock/2330 放財報亮點
// 跟 財報風險") — this page's first piece of real content since that split. See
// StockFinancialHighlightsRisksCard.vue's own comment for what populates each half (the existing
// guru-badge met/unmet system, flattened across categories, not a new judgment layer).
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
      <!-- One <section>/<h2> per page topic so the outline stays h1 → h2 → h3 (see main.css's own
           .stock-page-section comment). -->
      <section class="stock-page-section" aria-labelledby="stock-highlights-heading">
        <h2 id="stock-highlights-heading" class="stock-page-section__title">財報亮點與風險</h2>
        <StockFinancialHighlightsRisksCard :symbol="stock.code" />
      </section>
    </template>
  </div>
</template>

<style scoped>
/* No max-width/margin here on purpose — every other page gets its width from
   desktop.vue/mobile.vue's own .app-shell__inner / .app-shell__inner--centered wrapper (the
   置中/滿版 switch), so this page should too rather than fighting it with a second, independent
   cap. */
.stock-detail-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
</style>
