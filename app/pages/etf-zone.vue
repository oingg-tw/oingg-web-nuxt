<script setup lang="ts">
// Placeholder page — ETF 專區，未來將放 ETF 比較功能，包含相似度比較（找出成分股/產業重疊度
// 高的 ETF，協助評估替代或分散效果）。Shell only for now.
</script>

<template>
  <div class="etf-zone-page">
    <h1 class="etf-zone-page__title">ETF 專區</h1>
    <p class="etf-zone-page__subtitle">ETF 比較——追蹤費用率、成分股、報酬表現、相似度比較，協助挑選適合的 ETF</p>
    <el-empty description="功能開發中，敬請期待" />
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
  margin: -8px 0 16px;
}
</style>
