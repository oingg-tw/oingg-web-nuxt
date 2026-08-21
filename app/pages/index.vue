<script setup lang="ts">
import { Setting } from '@element-plus/icons-vue'

const { watchlist, columns, visibleColumnKeys, visibleColumns, removeStock } = useStocks()
</script>

<template>
  <div class="stock-page">
    <div class="stock-page__header">
      <h1 class="stock-page__title">自選股</h1>
      <el-popover placement="bottom-end" width="200" trigger="click">
        <template #reference>
          <el-button :icon="Setting" circle />
        </template>
        <div class="stock-page__column-picker">
          <p class="stock-page__column-picker-title">顯示欄位</p>
          <el-checkbox-group v-model="visibleColumnKeys">
            <el-checkbox v-for="column in columns" :key="column.key" :value="column.key" :label="column.label" />
          </el-checkbox-group>
        </div>
      </el-popover>
    </div>

    <div class="stock-page__content">
      <StockTable class="view-table" :stocks="watchlist" :columns="visibleColumns" @remove="removeStock" />
      <StockCard class="view-card" :stocks="watchlist" :columns="visibleColumns" @remove="removeStock" />
    </div>

    <StockSearchBar />
  </div>
</template>

<style scoped>
.stock-page {
  max-width: 1080px;
  margin: 0 auto;
  padding: 20px 16px calc(88px + env(safe-area-inset-bottom));
}

.stock-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.stock-page__title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.stock-page__column-picker-title {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.stock-page__column-picker :deep(.el-checkbox-group) {
  display: flex;
  flex-direction: column;
  gap: 4px;
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
