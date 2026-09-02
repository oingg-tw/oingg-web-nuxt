<script setup lang="ts">
// New page 2026-09-02 — homes the 6 short-term-trading cards moved off /dashboard's home
// screen when that was rebuilt to lead with 存股/retirement-investor signals (per the user's
// explicit call: "我不介意犧牲短線交易者" — demoted, not deleted, per conductor's framing:
// "降級不是刪除"). Same card components as before, unchanged; just relocated. No card picker
// here (unlike /dashboard) — this page is itself the opt-in destination for anyone who wants
// these signals, so there's no "too many cards" problem a picker would be solving.
</script>

<template>
  <div class="day-trading-page">
    <h1 class="day-trading-page__title">短線交易</h1>
    <p class="day-trading-page__subtitle">籌碼動向、量價異常與風險警示——適合當日沖銷、短線交易者參考</p>

    <div class="day-trading-page__grid">
      <DashboardMarginShortRatioCard class="day-trading-page__zone-primary" />
      <DashboardAttentionStockCard />
      <DashboardVolumeTop20Card />
      <DashboardDisposedStocksCard />
      <DashboardPriceChangeRankingCard />
    </div>
  </div>
</template>

<style scoped>
.day-trading-page {
  width: 100%;
}

.day-trading-page__title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 8px;
}

.day-trading-page__subtitle {
  font-size: 16px;
  color: var(--el-text-color-secondary);
  margin: 0 0 32px;
}

.day-trading-page__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.day-trading-page__zone-primary {
  grid-column: span 2;
}

@media (max-width: 900px) {
  .day-trading-page__grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .day-trading-page__grid {
    grid-template-columns: 1fr;
  }

  .day-trading-page__zone-primary {
    grid-column: span 1;
  }
}

.day-trading-page__grid :deep(.el-card) {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.day-trading-page__grid :deep(.el-card__header) {
  padding: 16px;
}

.day-trading-page__grid :deep(.el-card__body) {
  flex: 1;
  padding: 16px;
  min-height: 0;
}
</style>
