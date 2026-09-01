<script setup lang="ts">
// Moved from index.vue — "/" is now the public/SEO landing page (see index.vue's own
// comment), this is the actual signed-in-feeling functional home screen the app's own nav
// (app-features.ts's "首頁" entry) and logo link both point to.
//
// Started as eight card shells (per the user's own framing: "請幫我先做功能殼"), with fixture
// data for whichever bff-ts endpoint wasn't ready yet. Some have since been wired to real
// data (see each card's own comment) as bff-ts shipped them; 外資持股比率 (ForeignHoldingCard)
// was dropped entirely rather than wired up — analysis-ts's foreign_holding mirror is only
// ~20 companies right now and the ranking came back dominated by KY-registered shells
// (foreign-domiciled holding companies whose "foreign ownership %" isn't a meaningful signal
// the way it is for an ordinary TW-listed operating company), not worth showing until that
// mirror's coverage grows. Grid, not a fixed list, so the mismatched card shapes (some are
// ranked lists, some are a short warning list, one is a single index snapshot) can each size
// to their own natural height instead of being forced into uniform rows.
</script>

<template>
  <div class="dashboard-page">
    <h1 class="dashboard-page__title">總覽</h1>
    <p class="dashboard-page__subtitle">大盤即時行情、當日沖銷與短線交易相關資訊——主要提供每日交易者、短線交易者參考</p>

    <div class="dashboard-page__grid">
      <DashboardTaiexIndexCard />
      <DashboardInstitutionalTradingCard />
      <DashboardPriceRankingCard />
      <DashboardMarginShortRatioCard />
      <DashboardValuationRankingCard />
      <DashboardAttentionStockCard />
      <DashboardMaterialAnnouncementCard />
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
