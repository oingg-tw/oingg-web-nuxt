<script setup lang="ts">
// Moved from index.vue — "/" is now the public/SEO landing page (see index.vue's own
// comment), this is the actual signed-in-feeling functional home screen the app's own nav
// (app-features.ts's "首頁" entry) and logo link both point to.
</script>

<template>
  <div class="dashboard-page">
    <h1 class="dashboard-page__title">總覽</h1>
    <p class="dashboard-page__subtitle">大盤即時行情、當日沖銷與短線交易相關資訊——主要提供每日交易者、短線交易者參考</p>
    <el-empty description="即將推出" />
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
</style>
