<script setup lang="ts">
// Placeholder page — ETF 專區，未來將放 ETF 比較功能，包含相似度比較（找出成分股/產業重疊度
// 高的 ETF，協助評估替代或分散效果）。
//
// Was a small DashboardEtfRankingCard floated above a fixture-only ETFCard grid (invented
// fund names/risk flags, never real backend data). Per user request 2026-09-02, the fixture
// grid is gone — real bff-ts data (EtfRankingCard) is now this page's actual primary content,
// full page width instead of a small card, styled closer to the screener result table
// (default el-table size, stripe, no small-card max-height cap) since it's carrying that role
// now instead of being one card among several on the dashboard.
</script>

<template>
  <div class="etf-zone-page">
    <h1 class="etf-zone-page__title">ETF 專區</h1>
    <p class="etf-zone-page__subtitle">ETF 比較——追蹤費用率、規模、報酬表現，協助挑選適合的 ETF</p>

    <DashboardEtfRankingCard />
  </div>
</template>

<style scoped>
.etf-zone-page {
  width: 100%;
}

.etf-zone-page__title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 16px;
}

.etf-zone-page__subtitle {
  font-size: 16px;
  color: var(--el-text-color-secondary);
  margin: -8px 0 24px;
}
</style>
