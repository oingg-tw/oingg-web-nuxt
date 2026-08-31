<script setup lang="ts">
// Placeholder page — 持股管理，包含股利現金流儀表板。Shell only for now.
</script>

<template>
  <div class="holdings-page">
    <h1 class="holdings-page__title">持股管理</h1>
    <p class="holdings-page__subtitle">持股數量、成本管理，以及股利現金流儀表板——追蹤每檔持股的配息時間與現金流入</p>
    <el-empty description="功能開發中，敬請期待" />
  </div>
</template>

<style scoped>
.holdings-page {
  width: 100%;
}

.holdings-page__title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 16px;
}

.holdings-page__subtitle {
  font-size: 16px;
  color: var(--el-text-color-secondary);
  margin: -8px 0 16px;
}
</style>
