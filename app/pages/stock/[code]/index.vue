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
const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite } = useStockDetailSummary(code)

// Self-referencing canonical, always pointing at the bare `/stock/{code}` path — added 2026-09-12
// per the SEO governance research doc's own requirement that view-state query params not be left
// to accidentally get indexed as separate pages from the real canonical one.
const requestUrl = useRequestURL()
useHead({
  link: [{ rel: 'canonical', href: computed(() => `${requestUrl.origin}/stock/${code.value}`) }]
})

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
  <StockDetailSidebarNav :code="code" />

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
      title="找不到這檔股票"
      sub-title="請確認股票代號是否正確"
    >
      <template #extra>
        <el-button type="primary" @click="router.push('/')">回首頁</el-button>
      </template>
    </el-result>

    <template v-else>
      <!-- Page subject lives in the summary card's single <h1> (「台積電 2330 財報亮點與風險」)
           since 2026-09-19 — see StockSummaryCard.vue's own heading comment. -->
      <StockSummaryCard :stock="stock" :website="profile?.website ?? null" :is-favorite="isFavorite" :short-name="stockShortName" topic="財報亮點與風險" @toggle-favorite="toggleFavorite" />
      <StockFinancialHighlightsRisksCard :symbol="stock.code" />
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
