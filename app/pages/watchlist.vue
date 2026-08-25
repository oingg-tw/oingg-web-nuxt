<script setup lang="ts">
const { watchlist, columns, visibleColumnKeys, visibleColumns, removeStock } = useStocks()
</script>

<template>
  <div class="stock-page">
    <ClientOnly>
      <Teleport to="#layout-header-actions">
        <StockListActions v-model:visible-column-keys="visibleColumnKeys" :columns="columns" />
      </Teleport>
      <Teleport to="#layout-menu-actions">
        <StockListActions v-model:visible-column-keys="visibleColumnKeys" :columns="columns" />
      </Teleport>
    </ClientOnly>

    <h1 class="stock-page__title">自選股</h1>

    <div class="stock-page__content">
      <StockTable class="view-table" :stocks="watchlist" :columns="visibleColumns" @remove="removeStock" />
      <StockCard class="view-card" :stocks="watchlist" :columns="visibleColumns" @remove="removeStock" />
    </div>
  </div>
</template>

<style scoped>
.stock-page {
  max-width: 1080px;
  margin: 0 auto;
}

.stock-page__title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 16px;
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
