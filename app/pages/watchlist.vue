<script setup lang="ts">
// Real bug fixed 2026-09-14 (mock-data survey) — `watchlist` from useStocks() used to be a
// ready-made Stock[] straight from MOCK_STOCK_UNIVERSE; now useStocks() only tracks which CODES
// are on the list, and useWatchlistStocks resolves the real per-symbol quote for each one (see
// that composable's own comment for why N parallel single-symbol requests, not a batch endpoint
// that doesn't exist yet).
const { watchlistCodes, columns, visibleColumnKeys, visibleColumns, removeStock } = useStocks()
const { data: watchlist, pending, droppedCount } = useWatchlistStocks(watchlistCodes)
</script>

<template>
  <div class="stock-page">
    <div class="stock-page__header">
      <h1 class="stock-page__title">觀察清單</h1>
      <StockListActions v-model:visible-column-keys="visibleColumnKeys" :columns="columns" />
    </div>

    <p v-if="droppedCount > 0" class="stock-page__note">
      {{ droppedCount }} 檔股票目前沒有可用的報價資料，暫未顯示
    </p>

    <div v-loading="pending" class="stock-page__content">
      <el-empty v-if="!pending && !watchlistCodes.length" description="尚未加入任何股票" :image-size="64" />
      <template v-else>
        <StockTable class="view-table" :stocks="watchlist" :columns="visibleColumns" @remove="removeStock" />
        <StockCard class="view-card" :stocks="watchlist" :columns="visibleColumns" @remove="removeStock" />
      </template>
    </div>
  </div>
</template>

<style scoped>
.stock-page {
  width: 100%;
}

.stock-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0 0 16px;
}

.stock-page__title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.stock-page__note {
  margin: 0 0 16px;
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.view-card {
  display: none;
}

@media (max-width: 767px) {
  .view-table {
    display: none;
  }

  .view-card {
    display: flex;
  }
}
</style>
