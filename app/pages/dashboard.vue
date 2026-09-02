<script setup lang="ts">
// Moved from index.vue — "/" is now the public/SEO landing page (see index.vue's own
// comment), this is the actual signed-in-feeling functional home screen the app's own nav
// (app-features.ts's "首頁" entry) and logo link both point to.
//
// Started as eight fixture-data card shells (per the user's own framing: "請幫我先做功能殼").
// As bff-ts shipped real endpoints, cards were wired up one by one; the ones that never got
// wired (加權指數, 三大法人買賣超, 股價排行, 估值排行) were removed outright on 2026-09-01
// rather than left as permanent placeholders, along with 漲跌停幅度排行 (was wired to real
// data, but dropped per user request) and 外資持股比率 (dropped earlier — see git history —
// analysis-ts's foreign_holding mirror was too thin/KY-dominated to be a meaningful signal).
// 重大訊息公告 (MaterialAnnouncementCard) removed 2026-09-02 — twse-ts's material-announcements
// data has no source URL, so the card had no way to link out to the actual filing, which made
// it low-value as a headline-only list. ETF 排行 (EtfRankingCard) was briefly added here too
// but immediately moved to etf-zone.vue per user request — it's an ETF-zone concern, not a
// market-overview one; see that page's own comment.
//
// 2026-09-02 (later same day): repositioned around retirement/存股 investors, per the user's
// explicit call after a positioning discussion — "我不介意犧牲短線交易者" (fine sacrificing
// short-term traders), and conductor's business-side prioritization (存股 decision flow:
// 發現候選 → 確認體質安全 → 比較同業 → 持續追蹤). 券資比排行/今日注意股票/處置股清單/
// 成交量前20/漲跌幅排行 — all short-term-trading signals with little relevance to a
// buy-and-hold investor — moved to the new /day-trading page (demoted, not deleted, per
// conductor's framing: "降級不是刪除"; still fully wired, just not the first thing anyone
// sees). 月營收排行 (RevenueRankingCard) stayed — monthly revenue growth is a genuine
// fundamentals signal, not a short-term-trading one. New retirement-relevant cards land here
// as their backing endpoints get confirmed live with bff-ts (dividend yield ranking, PE/PB
// entry-point ranking, Guru scores were conductor's top picks — see git history for what
// actually shipped vs. what's still pending confirmation at this point in time).
//
// Grid rebuilt 2026-09-02 per docs/網格排版美學與實踐.md — was a masonry-style
// `auto-fill, minmax()` layout where row membership was whatever happened to fit, so card
// bottoms drifted out of alignment as soon as two neighbors had different content lengths
// (no shared 流線/flowline). Replaced with an explicit 3-column modular grid: 5 cards give
// deterministic 2-card + 3-card rows, so a plain `grid-template-columns: repeat(3, 1fr)` places
// them into exactly two clean rows without any manual row math. 券資比排行前20 spans 2 columns
// as the anchor zone (it carries the most data columns / deepest ranking of the five — a
// deliberate 複合網格-style asymmetric span, not an accident), and every card is stretched to
// its row's full height (CSS grid's own default `align-items: stretch`, previously overridden
// to `start`) so card edges land on a shared horizontal flowline instead of each card's own
// natural content height. Spacing follows the doc's 8pt/4pt token table directly: 24px between
// cards (space-md, "不同組件區塊間距"), 16px card padding (space-sm, "Card Padding"), 8px
// title→subtitle gap (space-xs), 32px subtitle→grid gap (space-lg, "頁面頂部導航與主內容間隙").
//
// Card picker added 2026-09-02 — same local-only useState pattern as the stock-detail page's
// useStockCards/StockDetailActions (see useDashboardCards.ts's own comment on why this isn't
// backend-persisted yet).
//
// lazy + server:false added to every dashboard composable's useAsyncData 2026-09-02 — bff-ts's
// own endpoint latency varies a lot in practice (observed spikes into the 5-13s range on a
// single endpoint), and Nuxt's SSR by default holds the ENTIRE page response until every
// useAsyncData call on it resolves — one slow card was turning "dashboard refresh" into a
// double-digit-second wait for the whole page, not just that one card. `lazy` alone does NOT
// fix this — it only skips blocking CLIENT-SIDE route transitions, not the initial SSR
// response (confirmed by measuring: adding lazy alone left full-page load times unchanged).
// `server: false` is what actually does it: these composables now fetch purely client-side
// after hydration, so the SSR response never touches bff-ts at all for these — the page shell
// renders instantly and each card streams its own data in once ready (see each card's own
// `pending`/`v-loading` handling), so a slow endpoint now only stalls its own card. Trade-off:
// dashboard data no longer appears in the server-rendered HTML (a no-JS/crawler view would see
// empty cards) — accepted since this is an authenticated, data-dense dashboard, not an
// SEO-relevant page.
const { cardDefs, categories, visibleCardIds, isVisible } = useDashboardCards()
</script>

<template>
  <div class="dashboard-page">
    <div class="dashboard-page__header">
      <div>
        <h1 class="dashboard-page__title">總覽</h1>
        <p class="dashboard-page__subtitle">存股與長期投資相關資訊——追蹤體質、估值與營收表現</p>
      </div>
      <DashboardCardPicker v-model:visible-card-ids="visibleCardIds" :card-defs="cardDefs" :categories="categories" />
    </div>

    <el-empty v-if="visibleCardIds.length === 0" description="尚未選擇任何卡片，點右上角設定圖示開啟" :image-size="80" />
    <div v-else class="dashboard-page__grid">
      <DashboardValuationRankingCard v-if="isVisible('valuation-ranking')" />
      <DashboardRevenueRankingCard v-if="isVisible('revenue-ranking')" />
    </div>
  </div>
</template>

<style scoped>
.dashboard-page {
  width: 100%;
}

.dashboard-page__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  margin: 0 0 32px;
}

.dashboard-page__title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 8px;
}

.dashboard-page__subtitle {
  font-size: 16px;
  color: var(--el-text-color-secondary);
  margin: 0;
}

.dashboard-page__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.dashboard-page__zone-primary {
  grid-column: span 2;
}

/* Base rules above must come before their media-query overrides below — same-specificity CSS
   falls back to source order, so an override placed before its base rule loses to it at every
   viewport regardless of which @media condition matches. */
@media (max-width: 900px) {
  .dashboard-page__grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .dashboard-page__grid {
    grid-template-columns: 1fr;
  }

  /* Without this, the primary card's unconditional span:2 forces the browser to implicitly
     grow a second column to satisfy it, splitting the intended single mobile column in two. */
  .dashboard-page__zone-primary {
    grid-column: span 1;
  }
}

/* Stretch every card to its row's shared height (the grid's own flowline) instead of each
   card sizing to its own content — el-card just needs to become a column flexbox so its body
   can absorb the extra height instead of the whole card overflowing its grid cell. */
.dashboard-page__grid :deep(.el-card) {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.dashboard-page__grid :deep(.el-card__header) {
  padding: 16px;
}

.dashboard-page__grid :deep(.el-card__body) {
  flex: 1;
  padding: 16px;
  min-height: 0;
}
</style>
