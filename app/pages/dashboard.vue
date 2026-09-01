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
// Remaining cards are all real data: 券資比排行, 今日注意股票, 重大訊息公告, 月營收排行,
// 成交量前20, 處置股清單. Grid, not a fixed list, so the mismatched card shapes (ranked
// lists vs. a short warning list) can each size to their own natural height.
</script>

<template>
  <div class="dashboard-page">
    <h1 class="dashboard-page__title">總覽</h1>
    <p class="dashboard-page__subtitle">大盤即時行情、當日沖銷與短線交易相關資訊——主要提供每日交易者、短線交易者參考</p>

    <div class="dashboard-page__grid">
      <DashboardMarginShortRatioCard />
      <DashboardAttentionStockCard />
      <DashboardMaterialAnnouncementCard />
      <DashboardRevenueRankingCard />
      <DashboardVolumeTop20Card />
      <DashboardDisposedStocksCard />
    </div>
  </div>
</template>

<style scoped>
.dashboard-page {
  width: 100%;
}

.dashboard-page__title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 16px;
}

.dashboard-page__subtitle {
  font-size: 16px;
  color: var(--el-text-color-secondary);
  margin: -8px 0 16px;
}

.dashboard-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 16px;
  align-items: start;
}
</style>
