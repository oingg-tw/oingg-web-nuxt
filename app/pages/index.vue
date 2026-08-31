<template>
  <div class="home-page">
    <h1 class="home-page__title">總覽</h1>
    <p class="home-page__subtitle">大盤即時行情、當日沖銷與短線交易相關資訊——主要提供每日交易者、短線交易者參考</p>
    <el-empty description="即將推出" />
  </div>
</template>

<style scoped>
.home-page {
  width: 100%;
}

.home-page__title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 16px;
}

.home-page__subtitle {
  font-size: 16px;
  color: var(--el-text-color-secondary);
  margin: -8px 0 16px;
}
</style>
