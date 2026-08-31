<script setup lang="ts">
const { watchlist, columns, visibleColumnKeys, visibleColumns, removeStock } = useStocks()
const pageActionsReady = usePageActionsReady()
</script>

<template>
  <div class="stock-page">
    <ClientOnly>
      <Teleport v-if="pageActionsReady" to="#page-actions">
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
  width: 100%;
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
