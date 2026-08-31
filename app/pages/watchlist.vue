<script setup lang="ts">
const { watchlist, columns, visibleColumnKeys, visibleColumns, removeStock } = useStocks()
</script>

<template>
  <div class="stock-page">
    <div class="stock-page__header">
      <h1 class="stock-page__title">觀察清單</h1>
      <StockListActions v-model:visible-column-keys="visibleColumnKeys" :columns="columns" />
    </div>

    <div class="stock-page__content">
      <StockTable class="view-table" :stocks="watchlist" :columns="visibleColumns" @remove="removeStock" />
      <StockCard class="view-card" :stocks="watchlist" :columns="visibleColumns" @remove="removeStock" />
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
